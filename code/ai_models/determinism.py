"""Helpers that keep model predictions reproducible."""

from typing import Any


def single_threaded(estimator: Any) -> Any:
    """Make ``estimator`` (a scikit-learn estimator or Pipeline) predict on one thread.

    ``RandomForestRegressor.predict`` with ``n_jobs != 1`` adds the per-tree predictions
    into a shared array from several threads. Floating-point addition is not associative,
    so the order in which the threads finish changes the last bits of the result and the
    same input can return slightly different values from one call to the next.

    Inference on a single row gains nothing from threads, so predictions run with
    ``n_jobs=1``: identical inputs then give bit-identical outputs. Training is not
    affected: every tree is fitted independently from its own seed, so fitting can stay
    parallel. The estimator is changed in place and returned for convenience.
    """
    params = {
        name: 1
        for name in estimator.get_params()
        if name == "n_jobs" or name.endswith("__n_jobs")
    }
    if params:
        estimator.set_params(**params)
    return estimator
