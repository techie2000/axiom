# ADR-005: RabbitMQ for Data Ingestion Pipeline

## Status

Accepted

## Date

2026-01-26

## Context

Axiom's data ingestion pipeline requires decoupling between:

1. **Data producers**: csv2json (converts CSV to JSON)
2. **Data consumers**: canonicalizer (standardizes and persists to PostgreSQL)

Requirements:

- Asynchronous processing of bulk data loads
- Ability to handle backpressure during high-volume imports
- Reliability and message persistence
- Support for retries and dead-letter queues
- Monitoring and observability

## Decision

We will use **RabbitMQ** as the message queue for the data ingestion pipeline.

### Data Flow

```
CSV files → csv2json → RabbitMQ → canonicalizer → PostgreSQL (Axiom)
```

### Queue Architecture

```
Exchange: axiom.data.exchange (topic)
├── Queue: axiom.reference.countries
├── Queue: axiom.reference.currencies
├── Queue: axiom.trading.trades
└── Queue: axiom.settlement.instructions

Dead Letter Exchange: axiom.data.dlx
└── Queue: axiom.data.failed
```

## Rationale

### Why RabbitMQ?

1. **Mature and proven**: Battle-tested message broker used in financial systems
2. **Reliable delivery**: Message persistence, acknowledgments, publisher confirms
3. **Flexible routing**: Topic exchanges for domain-based routing
4. **Good Go support**: Official AMQP library (streadway/amqp)
5. **Management UI**: Built-in monitoring and queue inspection
6. **Dead-letter queues**: Automatic handling of failed messages
7. **Resource efficient**: Lower overhead than Kafka for our use case

### Why Not Alternatives?

#### Kafka

- ❌ Overkill for our throughput (designed for millions of messages/sec)
- ❌ More complex operations (Zookeeper/KRaft, partition management)
- ❌ Higher resource requirements
- ✅ Would consider if we need long-term message retention or stream processing

#### AWS SQS

- ❌ Cloud vendor lock-in
- ❌ Higher latency than RabbitMQ
- ❌ Limited message ordering guarantees
- ✅ Would consider if already deeply invested in AWS

#### Redis Streams

- ❌ Less mature message guarantee semantics
- ❌ Not purpose-built for message queuing
- ❌ Message persistence requires careful configuration

#### Direct PostgreSQL (via LISTEN/NOTIFY)

- ❌ Not designed for high-throughput message queuing
- ❌ Limited message persistence guarantees
- ❌ Tightly couples components

## Consequences

### Positive

- **Decoupled services**: csv2json and canonicalizer can evolve independently
- **Backpressure handling**: Queue absorbs spikes in CSV upload volume
- **Reliability**: Messages persisted to disk, survive broker restarts
- **Retry logic**: Failed messages automatically requeued or sent to DLQ
- **Observability**: Monitor queue depths, processing rates, error rates
- **Scalability**: Can add more canonicalizer workers to increase throughput

### Negative

- **Additional infrastructure**: Another service to run, monitor, and maintain
- **Operational complexity**: Need to manage RabbitMQ clusters, backups
- **Network hop**: Adds latency compared to direct database writes (acceptable trade-off)

### Configuration Management

All RabbitMQ configuration via environment variables:

```env
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=axiom
RABBITMQ_PASSWORD=<secure-password>
RABBITMQ_VHOST=/axiom
RABBITMQ_EXCHANGE=axiom.data.exchange
RABBITMQ_QUEUE_PREFIX=axiom
```

### Message Format

Messages are JSON with standardized envelope:

```json
{
  "domain": "reference",
  "entity": "countries",
  "timestamp": "2026-01-26T10:30:00Z",
  "source": "csv2json",
  "payload": { /* entity data */ }
}
```

## Notes

- Use publisher confirms to ensure messages reach RabbitMQ
- Implement consumer acknowledgments after successful database writes
- Set up dead-letter queues for messages that fail after N retries
- Monitor queue depths as early warning for processing issues
- Consider message TTL for time-sensitive data
- Use RabbitMQ management plugin for operational visibility

## Related ADRs

- [ADR-002: PostgreSQL for Data Persistence](002-postgresql-for-data-persistence.md)
