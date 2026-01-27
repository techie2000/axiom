#!/bin/sh
# RabbitMQ initialization script
# Creates exchange and queues for Axiom data pipeline

# Wait for RabbitMQ to be fully ready
sleep 10

# Create exchange
rabbitmqadmin declare exchange name=axiom.data.exchange type=topic durable=true

# Create queues
rabbitmqadmin declare queue name=axiom.reference.countries durable=true

# Bind queues to exchange with routing keys
rabbitmqadmin declare binding source=axiom.data.exchange destination=axiom.reference.countries routing_key=reference.countries

echo "RabbitMQ initialization complete"
