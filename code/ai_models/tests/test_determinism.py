from ai_models.determinism import single_threaded
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler


def test_single_threaded_sets_every_n_jobs():
    forest = RandomForestRegressor(n_estimators=3, n_jobs=-1)
    assert single_threaded(forest) is forest
    assert forest.n_jobs == 1

    pipeline = Pipeline(
        [("scaler", RobustScaler()), ("model", RandomForestRegressor(n_jobs=4))]
    )
    assert single_threaded(pipeline) is pipeline
    assert pipeline.get_params()["model__n_jobs"] == 1


def test_single_threaded_leaves_estimators_without_n_jobs_alone():
    scaler = RobustScaler()
    assert single_threaded(scaler) is scaler
