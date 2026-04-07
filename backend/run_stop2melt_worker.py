from redis import Redis
from rq import SimpleWorker, Queue

REDIS_URL = "redis://localhost:6379/0"


def main():
    connection = Redis.from_url(REDIS_URL)
    queue = Queue("stop2melt", connection=connection)
    worker = SimpleWorker([queue], connection=connection)
    worker.work()


if __name__ == "__main__":
    main()
