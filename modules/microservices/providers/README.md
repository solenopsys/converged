# Microservices Group: providers

## Purpose
Groups adapters for external delivery providers, including push, SMS, SMTP, and SES. A common service boundary lets higher-level notification workflows select a channel without depending on provider-specific protocols or credentials.

## Responsibility Boundary
Owns provider-integration service split; does not own high-level notification business policy.
