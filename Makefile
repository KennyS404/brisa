# Makefile

.PHONY: start

start:
	@echo "Iniciando o projeto do whatsapp web..."
	@npm run --prefix whatsapp dev &

	@echo "Iniciando o servidor..."
	@npm run --prefix server start &
