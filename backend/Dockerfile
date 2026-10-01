FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B -q dependency:go-offline -DskipTests || true
COPY src src
RUN mvn -B -q package -DskipTests && cp target/kira-api-*.jar app.jar

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app
USER 10001
WORKDIR /app
COPY --from=build /workspace/app.jar app.jar
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s CMD wget -qO- http://localhost:8080/actuator/health/readiness || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
