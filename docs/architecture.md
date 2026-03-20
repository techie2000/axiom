# Architecture Overview

## System Design

Axiom is built as a modular monolith with clear boundaries between different domains:

### Layers

1. **Presentation Layer (API)**
   - REST API endpoints using Gin framework
   - JWT authentication
   - CORS configuration
   - Rate limiting
   - Input validation

2. **Application Layer (Handlers & Services)**
   - HTTP handlers for request/response handling
   - Business logic services
   - Command/Query separation (CQRS)
   - Transaction management

3. **Domain Layer (Models)**
   - Core business entities
   - Domain logic
   - Type definitions
   - Enum constants

4. **Infrastructure Layer (Repository & External Services)**
   - Database access using GORM
   - RabbitMQ integration
   - External API clients
   - Caching layer (PostgreSQL)

### Data Flow

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#4A90E2','primaryTextColor':'#000','primaryBorderColor':'#2E5C8A','lineColor':'#2E5C8A','secondaryColor':'#82B1FF','tertiaryColor':'#fff','fontSize':'14px'}}}%%
flowchart TD
    A[Client Request] --> B[API Gateway/Load Balancer]
    B --> C[Gin HTTP Handler]
    C --> D[Middleware<br/>Auth, CORS, Rate Limit, Logging]
    D --> E[Handler<br/>Request Validation]
    E --> F[Service Layer<br/>Business Logic]
    F --> G[Repository<br/>Data Access]
    G --> H[PostgreSQL Database]
    
    style A fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style H fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
```

### CQRS Pattern

The system separates read and write operations:

#### Commands (Write Operations)

- Create, Update, Delete operations
- Business rule validation
- Event publishing to RabbitMQ
- Audit log generation

#### Queries (Read Operations)

- Optimized read models
- Caching layer
- Pagination support
- Filtering and sorting

### Database Schema

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#4A90E2','primaryTextColor':'#000','primaryBorderColor':'#2E5C8A','lineColor':'#2E5C8A','secondaryColor':'#82B1FF','tertiaryColor':'#fff','fontSize':'14px'}}}%%
graph LR
    countries[countries<br/>reference data]
    currencies[currencies]
    addresses[addresses]
    entities[entities]
    accounts[accounts]
    instruments[instruments]
    ssis[ssis]
    
    countries --> addresses
    addresses --> entities
    entities --> accounts
    entities --> ssis
    instruments --> ssis
    currencies --> instruments
    
    style countries fill:#82B1FF,stroke:#2E5C8A,stroke-width:2px
    style currencies fill:#82B1FF,stroke:#2E5C8A,stroke-width:2px
    style addresses fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style entities fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style accounts fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style instruments fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style ssis fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
```

### Microservices Communication

While deployed as a monolith, internal services communicate through:

- Direct function calls (in-process)
- Event bus (RabbitMQ) for async operations
- Shared database (with schema separation)

### Scalability

- **Horizontal Scaling**: Stateless API servers behind load balancer
- **Database Scaling**: Read replicas, connection pooling
- **Caching**: PostgreSQL for frequently accessed data
- **Message Queue**: RabbitMQ for async processing

### Security

- JWT-based authentication
- HTTPS/TLS encryption
- SQL injection prevention (ORM)
- Input validation
- Rate limiting
- CORS configuration
- Audit logging

## Deployment Architecture

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor':'#4A90E2','primaryTextColor':'#000','primaryBorderColor':'#2E5C8A','lineColor':'#2E5C8A','secondaryColor':'#82B1FF','tertiaryColor':'#fff','fontSize':'14px'}}}%%
flowchart TD
    LB[Load Balancer]
    API1[API Server 1]
    API2[API Server 2]
    APIN[API Server N]
    PG_PRIMARY[PostgreSQL Primary]
    PG_REPLICA[PostgreSQL Replica]
    RMQ[RabbitMQ Cluster]
    
    LB --> API1
    LB --> API2
    LB --> APIN
    API1 --> PG_PRIMARY
    API2 --> PG_PRIMARY
    APIN --> PG_PRIMARY
    PG_PRIMARY -.replication.-> PG_REPLICA
    API1 --> RMQ
    API2 --> RMQ
    APIN --> RMQ
    
    style LB fill:#82B1FF,stroke:#2E5C8A,stroke-width:2px
    style API1 fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style API2 fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style APIN fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style PG_PRIMARY fill:#2E5C8A,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style PG_REPLICA fill:#2E5C8A,stroke:#2E5C8A,stroke-width:2px,color:#fff
    style RMQ fill:#82B1FF,stroke:#2E5C8A,stroke-width:2px
```

## Future Considerations

- Service extraction: If a module grows too large, it can be extracted as a microservice
- Event sourcing: For complete audit trail
- GraphQL: Alternative API interface
- Multi-tenancy: Data isolation per client

## Architecture as Code Pilot

Architecture as Code is being introduced incrementally to complement ADR and Mermaid documentation.

- [Architecture as Code Overview](./architecture-as-code/README.md)
- [Architecture as Code Pilot Scope](./architecture-as-code/pilot-scope.md)
- [ADR-0015 Architecture as Code (CALM) Pilot Adoption](./adr/adr-0015-architecture-as-code-calm-pilot.md)
