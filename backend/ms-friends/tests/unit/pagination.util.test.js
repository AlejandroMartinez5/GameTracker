const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { getPaginationParams, buildPaginationMeta } = require("../../src/utils/pagination.util");

describe("getPaginationParams", () => {
  it("usa la primera página con un límite de diez por defecto", () => {
    assert.deepEqual(getPaginationParams(), { page: 1, limit: 10, offset: 0 });
  });

  it("acepta el límite máximo y calcula el desplazamiento", () => {
    assert.deepEqual(getPaginationParams({ page: "3", limit: "50" }), {
      page: 3, limit: 50, offset: 100
    });
  });

  for (const query of [{ page: 0 }, { page: "1.5" }, { limit: "abc" }, { limit: 51 }]) {
    it("rechaza " + JSON.stringify(query), () => {
      assert.throws(() => getPaginationParams(query), { status: 400 });
    });
  }
});

describe("buildPaginationMeta", () => {
  it("omite enlaces de navegación cuando no hay resultados", () => {
    assert.deepEqual(buildPaginationMeta({ page: 2, limit: 10, total: 0 }), {
      page: 2, limit: 10, total: 0, totalPages: 0,
      hasNextPage: false, hasPreviousPage: false, nextPage: null, previousPage: null
    });
  });

  it("calcula la última página aunque esté incompleta", () => {
    assert.deepEqual(buildPaginationMeta({ page: 3, limit: 10, total: 21 }), {
      page: 3, limit: 10, total: 21, totalPages: 3,
      hasNextPage: false, hasPreviousPage: true, nextPage: null, previousPage: 2
    });
  });
});
