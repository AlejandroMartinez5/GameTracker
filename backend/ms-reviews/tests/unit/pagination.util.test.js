const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  getPaginationParams,
  buildPaginationMeta
} = require("../../src/utils/pagination.util");

describe("getPaginationParams", () => {
  it("usa page=1 y limit=10 por defecto", () => {
    assert.deepEqual(getPaginationParams(), { page: 1, limit: 10, offset: 0 });
    assert.deepEqual(getPaginationParams({ page: "", limit: null }), {
      page: 1,
      limit: 10,
      offset: 0
    });
  });

  it("convierte strings y calcula el offset", () => {
    assert.deepEqual(getPaginationParams({ page: "3", limit: "20" }), {
      page: 3,
      limit: 20,
      offset: 40
    });
  });

  it("acepta limit=50 (máximo)", () => {
    assert.equal(getPaginationParams({ limit: 50 }).limit, 50);
  });

  for (const value of ["0", "-1", "1.5", "abc"]) {
    it(`rechaza page=${value} con status 400`, () => {
      assert.throws(() => getPaginationParams({ page: value }), {
        status: 400,
        message: "page debe ser un entero mayor a 0"
      });
    });
  }

  it("rechaza limit mayor a 50", () => {
    assert.throws(() => getPaginationParams({ limit: 51 }), {
      status: 400,
      message: "limit no puede ser mayor a 50"
    });
  });
});

describe("buildPaginationMeta", () => {
  it("sin resultados devuelve 0 páginas y sin navegación", () => {
    assert.deepEqual(buildPaginationMeta({ page: 1, limit: 10, total: 0 }), {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      nextPage: null,
      previousPage: null
    });
  });

  it("página intermedia tiene anterior y siguiente", () => {
    const meta = buildPaginationMeta({ page: 2, limit: 10, total: 25 });

    assert.equal(meta.totalPages, 3);
    assert.equal(meta.hasNextPage, true);
    assert.equal(meta.hasPreviousPage, true);
    assert.equal(meta.nextPage, 3);
    assert.equal(meta.previousPage, 1);
  });

  it("última página no tiene siguiente", () => {
    const meta = buildPaginationMeta({ page: 3, limit: 10, total: 25 });

    assert.equal(meta.hasNextPage, false);
    assert.equal(meta.nextPage, null);
    assert.equal(meta.previousPage, 2);
  });
});
