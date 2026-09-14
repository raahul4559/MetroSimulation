.PHONY: db-setup dev-backend dev-frontend build-backend build-frontend verify

db-setup:
	cd database && ./setup.sh

dev-backend:
	cd backend && ./mvnw spring-boot:run

dev-frontend:
	cd frontend && npm install && npm run dev

build-backend:
	cd backend && ./mvnw clean package

build-frontend:
	cd frontend && npm install && npm run build

verify:
	@echo "Backend health:" && curl -sf http://localhost:8080/actuator/health && echo
	@echo "Simulation clock lines:" && curl -sf http://localhost:8080/api/v1/network/lines | head -c 200 && echo
	@echo "Metro network graph:" && curl -sf http://localhost:8080/api/metro/network | head -c 200 && echo
	@echo "Frontend:" && curl -sf -o /dev/null -w "%{http_code}\n" http://localhost:3000
