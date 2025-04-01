.PHONY: pull build up down logs restart clean deploy deploy-prod commit-and-deploy

pull:
	git pull origin main

build:
	docker buildx build -t bjishk .

up:
	docker compose up -d

dev:
	docker compose up

down:
	docker compose down

logs:
	docker compose logs -f

restart:
	docker compose restart

clean:
	docker compose down -v
	docker rmi bjishk

deploy: pull build down up

deploy-prod:
	ssh chol "cd ./bjishk && make deploy"

commit-and-deploy:
	git add .
	git commit
	git push origin main
	make deploy-prod 