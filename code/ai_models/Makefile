PYTHON ?= python3

.PHONY: install test lint artifacts clean

install:
	$(PYTHON) -m pip install -r requirements-dev.txt

test:
	cd .. && $(PYTHON) -m pytest ai_models/tests

lint:
	cd .. && $(PYTHON) -m pyflakes ai_models

artifacts:
	cd .. && $(PYTHON) -m ai_models.training.generate_artifacts

clean:
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
	rm -f artifacts/*.pkl artifacts/*.json
