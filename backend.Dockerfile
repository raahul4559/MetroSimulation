# Builds and runs the Spring Boot backend for Railway. Lives at the repo root (not backend/)
# because backend/pom.xml's Flyway/metro-data resource mappings reach outside the backend/
# directory (../database/migrations, ../data/metro) — the build needs the whole monorepo as its
# context, not just backend/, so this must NOT be deployed with a restrictive rootDirectory.

FROM eclipse-temurin:25-jdk-jammy AS build
WORKDIR /workspace

# Preserves repo-root-relative layout so pom.xml's ../database and ../data resolve exactly as
# they do in local dev.
COPY backend backend
COPY database database
COPY data data

WORKDIR /workspace/backend
RUN chmod +x mvnw
RUN ./mvnw -B clean package -DskipTests

FROM eclipse-temurin:25-jre-jammy AS runtime

# ffmpeg is required by the announcement-audio PA processing pipeline
# (com.nammametro.simulation.announcement.infrastructure.AudioProcessingService); without it,
# that feature just degrades gracefully to text-only captions, never breaks the app.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/backend/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
