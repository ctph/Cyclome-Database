import { listJobs, onlyAppJobs } from "./accountApi";

describe("Cyclome account job scoping", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("requests the account API with the Cyclome app filter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, jobs: [] }),
    });

    await listJobs({ limit: 20, appSlug: "cyclome" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/jobs");
    expect(parsed.searchParams.get("limit")).toBe("20");
    expect(parsed.searchParams.get("app")).toBe("cyclome");
    expect(options.credentials).toBe("include");
  });

  test("defensively removes jobs belonging to other StructF apps", () => {
    const jobs = [
      { id: "job-cyclome", appSlug: "cyclome" },
      { id: "job-agrivax", appSlug: "agrivax" },
      { id: "job-anionpdb", appSlug: "anionpdb" },
    ];

    expect(onlyAppJobs(jobs, "cyclome")).toEqual([
      { id: "job-cyclome", appSlug: "cyclome" },
    ]);
    expect(onlyAppJobs(null, "cyclome")).toEqual([]);
  });
});
