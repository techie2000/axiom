module github.com/techie2000/axiom/canonicalizer

go 1.21

require (
	github.com/lib/pq v1.10.9
	github.com/rabbitmq/amqp091-go v1.9.0
	github.com/techie2000/axiom/modules/reference/countries v0.0.0
)

replace github.com/techie2000/axiom/modules/reference/countries => ../modules/reference/countries
