const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const parsePositiveInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} debe ser un entero mayor a 0`);
    error.status = 400;
    throw error;
  }

  return parsed;
};

const getPaginationParams = ({ page, limit } = {}) => {
  const parsedPage = parsePositiveInteger(page, "page") || DEFAULT_PAGE;
  const parsedLimit = parsePositiveInteger(limit, "limit") || DEFAULT_LIMIT;

  if (parsedLimit > MAX_LIMIT) {
    const error = new Error(`limit no puede ser mayor a ${MAX_LIMIT}`);
    error.status = 400;
    throw error;
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit
  };
};

const buildPaginationMeta = ({ page, limit, total }) => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
    nextPage: page < totalPages ? page + 1 : null,
    previousPage: page > 1 && totalPages > 0 ? page - 1 : null
  };
};

module.exports = {
  getPaginationParams,
  buildPaginationMeta
};
