import { logger } from './logger.js';

/**
 * Monitoring and alerting for critical failures
 * Tracks confirmation failures and provides structured alerts for investigation
 */

export interface ConfirmationFailure {
  bookingId: string;
  customerId: string;
  customerPhone: string;
  service: string;
  location: string;
  appointmentStart: string;
  failureType: 'email' | 'sms' | 'both' | 'calendar' | 'database';
  failureMessage: string;
  timestamp: string;
}

export interface EmailFailure {
  to: string;
  subject: string;
  error: string;
  timestamp: string;
}

export interface SmsFailure {
  to: string;
  message: string;
  error: string;
  timestamp: string;
}

class MonitoringService {
  /**
   * Log a confirmation failure with structured data for alerts
   * This is called when email, SMS, or calendar operations fail after a booking is created
   */
  logConfirmationFailure(failure: ConfirmationFailure): void {
    logger.error(
      {
        type: 'CONFIRMATION_FAILURE',
        bookingId: failure.bookingId,
        customerId: failure.customerId,
        customerPhone: failure.customerPhone,
        service: failure.service,
        location: failure.location,
        appointmentStart: failure.appointmentStart,
        failureType: failure.failureType,
        failureMessage: failure.failureMessage,
        timestamp: failure.timestamp,
      },
      `⚠️  Booking ${failure.bookingId} created but ${failure.failureType} confirmation failed`
    );

    // In production, this would trigger an alert to the developer
    // via email, Slack, or your monitoring system
    if (process.env.NODE_ENV === 'production') {
      this.triggerAlert(failure);
    }
  }

  /**
   * Log email delivery failure
   */
  logEmailFailure(failure: EmailFailure): void {
    logger.warn(
      {
        type: 'EMAIL_FAILURE',
        to: failure.to,
        subject: failure.subject,
        error: failure.error,
        timestamp: failure.timestamp,
      },
      `📧 Email confirmation failed for ${failure.to}`
    );
  }

  /**
   * Log SMS delivery failure
   */
  logSmsFailure(failure: SmsFailure): void {
    logger.warn(
      {
        type: 'SMS_FAILURE',
        to: failure.to,
        error: failure.error,
        timestamp: failure.timestamp,
      },
      `📱 SMS confirmation failed for ${failure.to}`
    );
  }

  /**
   * Log Google Calendar integration error
   */
  logCalendarError(error: {
    accountId: string;
    operation: string;
    error: string;
    timestamp: string;
  }): void {
    logger.error(
      {
        type: 'CALENDAR_ERROR',
        accountId: error.accountId,
        operation: error.operation,
        error: error.error,
        timestamp: error.timestamp,
      },
      `📅 Google Calendar ${error.operation} failed`
    );
  }

  /**
   * Log token refresh failure - indicates need for re-authentication
   */
  logTokenRefreshFailure(error: {
    accountId: string;
    error: string;
    timestamp: string;
  }): void {
    logger.error(
      {
        type: 'TOKEN_REFRESH_FAILURE',
        accountId: error.accountId,
        error: error.error,
        timestamp: error.timestamp,
      },
      `🔑 Google OAuth token refresh failed - re-authentication required`
    );

    if (process.env.NODE_ENV === 'production') {
      this.sendDeveloperAlert(
        'Token Refresh Failed',
        `Google OAuth token refresh failed for account ${error.accountId}. ` +
          `User must re-authorize in the admin dashboard. Error: ${error.error}`
      );
    }
  }

  /**
   * Log race condition detection
   */
  logRaceCondition(error: {
    bookingId: string;
    location: string;
    appointmentStart: string;
    timestamp: string;
  }): void {
    logger.info(
      {
        type: 'RACE_CONDITION_DETECTED',
        bookingId: error.bookingId,
        location: error.location,
        appointmentStart: error.appointmentStart,
        timestamp: error.timestamp,
      },
      `⚡ Race condition detected: slot taken between availability check and booking`
    );
  }

  /**
   * Log API performance metrics
   */
  logPerformanceMetric(metric: {
    endpoint: string;
    responseTime: number;
    status: number;
    timestamp: string;
  }): void {
    // Only log slow requests
    if (metric.responseTime > 800) {
      logger.warn(
        {
          type: 'SLOW_REQUEST',
          endpoint: metric.endpoint,
          responseTime: metric.responseTime,
          status: metric.status,
          timestamp: metric.timestamp,
        },
        `⏱️  Slow response: ${metric.endpoint} took ${metric.responseTime.toFixed(0)}ms`
      );
    }
  }

  /**
   * Trigger alert for critical failures (would integrate with your alerting system)
   */
  private triggerAlert(failure: ConfirmationFailure): void {
    // This is where you would integrate with your monitoring system
    // Examples:
    // - Send email to developer
    // - Post to Slack channel
    // - Create PagerDuty incident
    // - Log to monitoring service (Sentry, DataDog, etc)

    logger.error(
      {
        type: 'ALERT_TRIGGERED',
        failure,
      },
      '🚨 CRITICAL: Confirmation delivery failed - manual intervention may be required'
    );

    // Example: Send to Slack
    // await sendSlackAlert(failure);

    // Example: Send email
    // await sendEmailAlert(failure);
  }

  /**
   * Send developer alert for critical issues
   */
  private async sendDeveloperAlert(
    subject: string,
    message: string
  ): Promise<void> {
    logger.error(
      {
        type: 'DEVELOPER_ALERT',
        subject,
        message,
      },
      `🔴 ${subject}`
    );

    // In production, you would send this to your actual alerting system
    // For now, it's just structured logging that your log aggregation service can pick up
  }

  /**
   * Health check for monitoring systems
   * Returns the number of critical failures in the last hour
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    recentFailures: number;
    lastFailureTime?: string;
  }> {
    // This would typically query your logs/metrics database
    // For now, returning a placeholder
    return {
      status: 'healthy',
      recentFailures: 0,
    };
  }
}

export const monitoring = new MonitoringService();
