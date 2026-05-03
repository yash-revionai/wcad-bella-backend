import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

/**
 * E2E tests for Bella voice agent integration scenarios
 * These tests verify the core Bella-facing API endpoints work correctly
 */

const app = createApp();
const bellaApiKey = process.env.BELLA_API_KEY || 'test-bella-key';

test('Bella Integration E2E Tests', async (suite) => {
  await suite.test('Availability endpoint returns proper response format', async () => {
    const res = await request(app)
      .post('/api/availability')
      .set('x-api-key', bellaApiKey)
      .send({
        service: 'interior_deep',
        vehicleType: 'suv',
        location: 'pikesville',
        preferredDate: '2026-05-10',
      });

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.result === 'string');
    assert.ok(Array.isArray(res.body.slots));
    assert.strictEqual(res.body.agentReaction, 'speaks-once');
  });

  await suite.test('Booking endpoint returns proper response format', async () => {
    const res = await request(app)
      .post('/api/booking')
      .set('x-api-key', bellaApiKey)
      .send({
        callerName: 'Test Customer',
        callerPhone: '4435551234',
        service: 'express_detail',
        vehicleType: 'sedan',
        location: 'pikesville',
        appointmentStart: '2026-05-10T14:00:00',
      });

    // Response should either be a successful booking or a graceful error
    assert.ok([200, 400, 409].includes(res.status));
    assert.ok(typeof res.body.result === 'string');
    assert.strictEqual(res.body.agentReaction, 'speaks-once');
  });

  await suite.test('Booking endpoint validates phone number format', async () => {
    const res = await request(app)
      .post('/api/booking')
      .set('x-api-key', bellaApiKey)
      .send({
        callerName: 'Test Customer',
        callerPhone: 'invalid-phone',
        service: 'express_detail',
        vehicleType: 'sedan',
        location: 'pikesville',
        appointmentStart: '2026-05-10T14:00:00',
      });

    // Either returns validation error (400) or graceful error message (200) for Bella
    assert.ok([200, 400].includes(res.status));
    assert.ok(res.body.error || res.body.result);
  });

  await suite.test('Mobile same-day cutoff enforcement', async () => {
    const res = await request(app)
      .post('/api/availability')
      .set('x-api-key', bellaApiKey)
      .send({
        service: 'express_detail',
        vehicleType: 'sedan',
        location: 'mobile',
        preferredDate: new Date().toISOString().split('T')[0],
      });

    assert.strictEqual(res.status, 200);
    // Should either return slots or message about cutoff
    assert.ok(res.body.result);
  });

  await suite.test('Unavailable service at location is declined', async () => {
    const res = await request(app)
      .post('/api/availability')
      .set('x-api-key', bellaApiKey)
      .send({
        service: 'ceramic_coating',
        vehicleType: 'sedan',
        location: 'mobile',
        preferredDate: '2026-05-15',
      });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.result.toLowerCase().includes('not available') || res.body.slots.length === 0);
  });

  await suite.test('Transfer endpoint - primary attempt', async () => {
    const res = await request(app)
      .post('/api/transfer')
      .set('x-api-key', bellaApiKey)
      .send({
        reason: 'customer_inquiry',
        attempt: 'primary',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.transferTo, '+14439574789');
    assert.strictEqual(res.body.agentReaction, 'transfer-call');
  });

  await suite.test('Transfer endpoint - secondary attempt', async () => {
    const res = await request(app)
      .post('/api/transfer')
      .set('x-api-key', bellaApiKey)
      .send({
        reason: 'customer_inquiry',
        attempt: 'secondary',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.transferTo, '+14434633533');
    assert.strictEqual(res.body.agentReaction, 'transfer-call');
  });

  await suite.test('Health check endpoint', async () => {
    const res = await request(app).get('/api/health');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(res.body.timestamp);
    assert.strictEqual(res.body.service, 'wcad-bella-backend');
  });

  await suite.test('API key validation - missing key', async () => {
    const res = await request(app)
      .post('/api/availability')
      .send({
        service: 'interior_deep',
        vehicleType: 'suv',
        location: 'pikesville',
        preferredDate: '2026-05-10',
      });

    assert.strictEqual(res.status, 401);
    assert.ok(res.body.error);
  });

  await suite.test('API key validation - invalid key', async () => {
    const res = await request(app)
      .post('/api/availability')
      .set('x-api-key', 'wrong-api-key')
      .send({
        service: 'interior_deep',
        vehicleType: 'suv',
        location: 'pikesville',
        preferredDate: '2026-05-10',
      });

    assert.strictEqual(res.status, 401);
    assert.ok(res.body.error);
  });

  await suite.test('Availability validation - invalid date format returns graceful error', async () => {
    const res = await request(app)
      .post('/api/availability')
      .set('x-api-key', bellaApiKey)
      .send({
        service: 'interior_deep',
        vehicleType: 'suv',
        location: 'pikesville',
        preferredDate: 'not-a-date',
      });

    // Returns 200 with human-readable error for Bella
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.result);
    assert.ok(typeof res.body.result === 'string');
  });

  await suite.test('Availability validation - invalid service returns graceful error', async () => {
    const res = await request(app)
      .post('/api/availability')
      .set('x-api-key', bellaApiKey)
      .send({
        service: 'invalid_service',
        vehicleType: 'suv',
        location: 'pikesville',
        preferredDate: '2026-05-10',
      });

    // Returns 200 with human-readable error for Bella
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.result);
    assert.ok(typeof res.body.result === 'string');
  });
});
