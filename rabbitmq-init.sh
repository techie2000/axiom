#!/bin/sh
# RabbitMQ initialization script
# Creates exchange, queues, and dead letter queue for Axiom data pipeline

# Wait for RabbitMQ to be fully ready
sleep 10

# Create main exchange
rabbitmqadmin declare exchange name=axiom.data.exchange type=topic durable=true

# Create dead letter exchange (DLX)
rabbitmqadmin declare exchange name=axiom.data.dlx type=topic durable=true

# Create dead letter queue (DLQ)
rabbitmqadmin declare queue name=axiom.reference.countries.dlq durable=true

# Bind DLQ to DLX
rabbitmqadmin declare binding source=axiom.data.dlx destination=axiom.reference.countries.dlq routing_key=reference.countries

# Create main queue with DLX configuration
rabbitmqadmin declare queue name=axiom.reference.countries durable=true \
  arguments='{"x-dead-letter-exchange":"axiom.data.dlx","x-dead-letter-routing-key":"reference.countries"}'

# Bind main queue to main exchange
rabbitmqadmin declare binding source=axiom.data.exchange destination=axiom.reference.countries routing_key=reference.countries

echo "RabbitMQ initialization complete (with DLX/DLQ)"
