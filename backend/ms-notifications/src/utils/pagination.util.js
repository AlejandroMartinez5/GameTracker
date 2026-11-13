const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const getPaginationParams = ({ page, limit } = {}) => {
  const parsedPage = Number(page || DEFAULT_PAGE);
  const parsedLimit = Number(limit || DEFAULT_LIMIT);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw Object.assign(new Error("page debe ser un entero mayor a 0"), { status: 400 });
  }
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
    throw Object.assign(new Error(`limit debe ser un entero entre 1 y ${MAX_LIMIT}`), { status: 400 });
  }

  return { page: parsedPage, limit: parsedLimit, offset: (parsedPage - 1) * parsedLimit };
};

const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPreviousPage: page > 1
});

module.exports = { getPaginationParams, buildPaginationMeta };

