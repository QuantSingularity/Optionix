import pytest
from ai_models.training.generate_artifacts import generate


@pytest.fixture(scope="session")
def artifact_dir(tmp_path_factory):
    directory = str(tmp_path_factory.mktemp("artifacts"))
    generate(directory, bars=2500)
    return directory
