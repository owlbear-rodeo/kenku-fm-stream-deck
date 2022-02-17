/**
 * Circuit Breaker pattern for handling requests to the remote playback state.
 * The requests will fail if Kenku FM is closed so this pattern helps reduce failed requests.
 * https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern
 * Code adapted from https://medium.com/geekculture/nodejs-circuit-breaker-pattern-ed6b31896a57
 */
class CircuitBreaker {
  /** The state of the breaker either "OPENED", "HALF" or "CLOSED" */
  state = "OPENED";

  /** Timeout in ms to wait when in a half state before opening the breaker */
  openTimeout = 10000;
  /** Timeout in ms to wait when in a closed state before triggering a new request */
  closedTimeout = 15000;
  /** Number of failed requests before checking whether the breaker should close */
  failedRequestThreshold = 5;
  /** Percentage of requests that need to have failed before actually closing the breaker */
  failedRequestPercentageThreshold = 50;

  halfFinishTime = undefined;
  closedRetryTime = undefined;

  failCount = 0;
  successCount = 0;

  constructor(request) {
    this.request = request;
  }

  async fire() {
    if (this.state === "CLOSED") {
      const retry = Date.now() > this.closedRetryTime;
      if (!retry) {
        throw new Error("Breaker is closed");
      }
    }

    try {
      const response = await this.request();
      return this.success(response);
    } catch (e) {
      return this.fail(e);
    }
  }

  resetStatistics() {
    this.successCount = 0;
    this.failCount = 0;
    this.halfFinishTime = undefined;
  }

  success(response) {
    if (this.state === "HALF") {
      this.successCount++;
      if (Date.now() >= this.halfFinishTime) {
        this.state = "OPENED";
        this.resetStatistics();
      }
    }

    if (this.state === "CLOSED") {
      this.state = "OPENED";
      this.resetStatistics();
    }
    return response;
  }

  fail(e) {
    if (this.state === "CLOSED") {
      this.closedRetryTime = Date.now() + this.closedTimeout;
      return e;
    }

    if (this.state === "OPENED") {
      this.failCount = 1;
      this.state = "HALF";
      this.halfFinishTime = Date.now() + this.openTimeout;
      return e;
    }

    if (this.state === "HALF") {
      this.failCount++;

      if (Date.now() > this.halfFinishTime) {
        this.resetStatistics();
        this.failCount = 1;
        this.halfFinishTime = Date.now() + this.openTimeout;
        return e;
      }

      if (this.failCount >= this.failedRequestThreshold) {
        const failRate =
          (this.failCount * 100) / (this.failCount + this.successCount);
        if (failRate >= this.failedRequestPercentageThreshold) {
          this.state = "CLOSED";
          this.resetStatistics();
          this.closedRetryTime = Date.now() + this.closedTimeout;
          return e;
        }

        this.resetStatistics();
        this.failCount = 1;
        this.halfFinishTime = Date.now() + this.openTimeout;
        return e;
      }
    }
  }
}
