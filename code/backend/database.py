import logging
from typing import Generator, Type
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool, NullPool, StaticPool, Pool
from .config import settings
from .models import Base

logger = logging.getLogger(__name__)

# Determine pool class based on database type
database_url = settings.database_url
poolclass: Type[Pool]
if database_url.startswith("sqlite"):
    # SQLite needs special pooling
    poolclass = StaticPool if ":memory:" in database_url else NullPool
    connect_args = {"check_same_thread": False}
    pool_pre_ping = False
else:
    poolclass = QueuePool
    connect_args = {}
    pool_pre_ping = True

try:
    engine = create_engine(
        database_url,
        poolclass=poolclass,
        pool_size=settings.database_pool_size if poolclass == QueuePool else None,
        max_overflow=settings.database_max_overflow if poolclass == QueuePool else None,
        pool_pre_ping=pool_pre_ping,
        echo=settings.debug,
        connect_args=connect_args,
    )
except Exception as e:
    logger.error(f"Failed to create database engine: {e}")
    # Fallback to SQLite in-memory
    logger.warning("Falling back to SQLite in-memory database")
    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables() -> None:
    """Create all database tables"""
    global engine, SessionLocal
    try:
        # Test connection first
        with engine.connect():
            pass
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        logger.warning("Falling back to SQLite in-memory database")
        # Recreate engine with SQLite
        engine = create_engine(
            "sqlite:///:memory:",
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully (SQLite)")


def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session

    Yields:
        Session: SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session() -> Session:
    """
    Get a database session for direct use

    Returns:
        Session: SQLAlchemy database session
    """
    return SessionLocal()
