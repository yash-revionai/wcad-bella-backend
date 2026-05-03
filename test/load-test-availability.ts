/**
 * Load test for /api/availability endpoint
 *
 * Run with: npx ts-node test/load-test-availability.ts
 *
 * This test simulates concurrent requests to the availability endpoint
 * to verify it meets the performance requirement of < 800ms response time
 * with a maximum acceptable of 1500ms.
 */

import http from 'http';
import { performance } from 'perf_hooks';

interface LoadTestConfig {
  host: string;
  port: number;
  concurrentRequests: number;
  totalRequests: number;
  timeout: number;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsUnder800ms: number;
  requestsUnder1500ms: number;
  requestsAbove1500ms: number;
}

const config: LoadTestConfig = {
  host: process.env.BACKEND_URL || 'http://localhost:3001',
  port: 3001,
  concurrentRequests: 10,
  totalRequests: 100,
  timeout: 5000,
};

class LoadTestRunner {
  private responseTimes: number[] = [];
  private successCount = 0;
  private failureCount = 0;
  private startTime = 0;

  async run(config: LoadTestConfig): Promise<LoadTestResult> {
    console.log('🚀 Starting load test for /api/availability');
    console.log(`   Target: ${config.host}`);
    console.log(`   Concurrent requests: ${config.concurrentRequests}`);
    console.log(`   Total requests: ${config.totalRequests}`);
    console.log('');

    this.startTime = performance.now();

    const batches = Math.ceil(config.totalRequests / config.concurrentRequests);
    let requestCount = 0;

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(
        config.concurrentRequests,
        config.totalRequests - requestCount
      );

      const promises = Array.from({ length: batchSize }, () =>
        this.makeRequest(config)
      );

      await Promise.all(promises);
      requestCount += batchSize;

      // Progress indicator
      const progress = Math.round((requestCount / config.totalRequests) * 100);
      process.stdout.write(`\r   Progress: ${progress}% (${requestCount}/${config.totalRequests})`);
    }

    console.log('\n');

    return this.generateReport();
  }

  private makeRequest(config: LoadTestConfig): Promise<void> {
    return new Promise((resolve) => {
      const requestStartTime = performance.now();
      const apiKey = process.env.BELLA_API_KEY || 'test-key';

      const options = {
        hostname: 'localhost',
        port: config.port,
        path: '/api/availability',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      };

      const payload = JSON.stringify({
        service: 'interior_deep',
        vehicleType: 'suv',
        location: 'pikesville',
        preferredDate: '2026-05-10',
      });

      const timeout = setTimeout(() => {
        this.failureCount++;
        resolve();
      }, config.timeout);

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          clearTimeout(timeout);
          const responseTime = performance.now() - requestStartTime;
          this.responseTimes.push(responseTime);

          if (res.statusCode === 200) {
            this.successCount++;
          } else {
            this.failureCount++;
          }

          resolve();
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        this.failureCount++;
        console.error('Request error:', error.message);
        resolve();
      });

      req.write(payload);
      req.end();
    });
  }

  private generateReport(): LoadTestResult {
    const sortedTimes = this.responseTimes.sort((a, b) => a - b);
    const total = this.responseTimes.length;

    const result: LoadTestResult = {
      totalRequests: this.successCount + this.failureCount,
      successfulRequests: this.successCount,
      failedRequests: this.failureCount,
      avgResponseTime: sortedTimes.reduce((a, b) => a + b, 0) / total,
      minResponseTime: sortedTimes[0] ?? 0,
      maxResponseTime: sortedTimes[total - 1] ?? 0,
      p50ResponseTime: sortedTimes[Math.floor(total * 0.5)] ?? 0,
      p95ResponseTime: sortedTimes[Math.floor(total * 0.95)] ?? 0,
      p99ResponseTime: sortedTimes[Math.floor(total * 0.99)] ?? 0,
      requestsUnder800ms: sortedTimes.filter((t) => t < 800).length,
      requestsUnder1500ms: sortedTimes.filter((t) => t < 1500).length,
      requestsAbove1500ms: sortedTimes.filter((t) => t >= 1500).length,
    };

    this.printReport(result);
    return result;
  }

  private printReport(result: LoadTestResult): void {
    console.log('📊 Load Test Results');
    console.log('═'.repeat(50));
    console.log(`Total Requests:        ${result.totalRequests}`);
    console.log(`Successful:            ${result.successfulRequests} ✅`);
    console.log(`Failed:                ${result.failedRequests} ❌`);
    console.log('');
    console.log('Response Times (ms):');
    console.log(`  Min:                 ${result.minResponseTime.toFixed(2)}`);
    console.log(`  Max:                 ${result.maxResponseTime.toFixed(2)}`);
    console.log(`  Average:             ${result.avgResponseTime.toFixed(2)}`);
    console.log(`  P50 (Median):        ${result.p50ResponseTime.toFixed(2)}`);
    console.log(`  P95:                 ${result.p95ResponseTime.toFixed(2)}`);
    console.log(`  P99:                 ${result.p99ResponseTime.toFixed(2)}`);
    console.log('');
    console.log('SLA Performance:');
    console.log(
      `  < 800ms (Target):     ${result.requestsUnder800ms}/${result.successfulRequests} (${(
        (result.requestsUnder800ms / result.successfulRequests) *
        100
      ).toFixed(1)}%) ${
        result.requestsUnder800ms / result.successfulRequests > 0.95
          ? '✅'
          : '⚠️'
      }`
    );
    console.log(
      `  < 1500ms (Max):       ${result.requestsUnder1500ms}/${result.successfulRequests} (${(
        (result.requestsUnder1500ms / result.successfulRequests) *
        100
      ).toFixed(1)}%) ${
        result.requestsUnder1500ms / result.successfulRequests === 1
          ? '✅'
          : '⚠️'
      }`
    );
    console.log(
      `  ≥ 1500ms (Over):      ${result.requestsAbove1500ms}/${result.successfulRequests}`
    );
    console.log('═'.repeat(50));

    // Summary
    const passTargetSLA =
      result.requestsUnder800ms / result.successfulRequests > 0.95;
    const passMaxSLA =
      result.requestsUnder1500ms / result.successfulRequests === 1;

    if (passTargetSLA && passMaxSLA) {
      console.log('✅ PASSED: Meets performance targets');
    } else if (passMaxSLA) {
      console.log('⚠️  WARNING: Meets max SLA but not target SLA');
    } else {
      console.log('❌ FAILED: Exceeds maximum acceptable latency');
    }
  }
}

// Run the load test
const runner = new LoadTestRunner();
runner
  .run(config)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Load test error:', error);
    process.exit(1);
  });
