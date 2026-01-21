FROM debezium/connect:3.0.0.Final

# Install JDBC Sink Connector plugin
USER root
RUN cd /kafka/connect && \
    curl -L https://repo1.maven.org/maven2/io/debezium/debezium-connector-jdbc/3.0.0.Final/debezium-connector-jdbc-3.0.0.Final-plugin.tar.gz | tar xz && \
    chown -R kafka:kafka /kafka/connect

USER kafka
