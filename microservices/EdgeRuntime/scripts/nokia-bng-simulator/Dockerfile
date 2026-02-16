FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY main.go .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /nokia-bng-simulator .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /nokia-bng-simulator /usr/local/bin/nokia-bng-simulator
ENTRYPOINT ["nokia-bng-simulator"]
