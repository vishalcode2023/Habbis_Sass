const { error } = require("../utils/apiResponse");

/**
 * Express middleware factory for Joi validation.
 *
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {"body"|"query"|"params"} source - Where to pull data from
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error: joiError, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (joiError) {
      const errors = joiError.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      }));
      return error(res, 422, "Validation failed", errors);
    }

    req[source] = value; // replace with sanitised value
    next();
  };
};

module.exports = validate;
