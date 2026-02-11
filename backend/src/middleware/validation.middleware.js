const Joi = require('joi');

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    next();
  };
};

// Auth validation schemas
const authSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .message('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    fullName: Joi.string().min(2).max(100),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    role: Joi.string().valid('ADMIN', 'ORGANIZER', 'PLAYER', 'SPECTATOR'),
  }),

  login: Joi.object({
    emailOrUsername: Joi.string().required(),
    password: Joi.string().required(),
  }),
};

// Tournament validation schemas
const tournamentSchemas = {
  create: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).allow('', null),
    startDate: Joi.date().iso().greater('now').required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
    location: Joi.string().min(3).max(200).required(),
    maxParticipants: Joi.number().integer().min(2).max(1000).required(),
    tournamentType: Joi.string().valid('SINGLES', 'DOUBLES', 'MIXED').required(),
    format: Joi.string().valid('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN'),
  }),

  update: Joi.object({
    name: Joi.string().min(3).max(200),
    description: Joi.string().max(2000).allow('', null),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
    location: Joi.string().min(3).max(200),
    maxParticipants: Joi.number().integer().min(2).max(1000),
    tournamentType: Joi.string().valid('SINGLES', 'DOUBLES', 'MIXED'),
    format: Joi.string().valid('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN'),
    status: Joi.string().valid('DRAFT', 'OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED'),
  }).min(1),

  register: Joi.object({
    partnerId: Joi.string().uuid().allow(null),
  }),
};

// Match validation schemas
const matchSchemas = {
  create: Joi.object({
    tournamentId: Joi.string().uuid().required(),
    round: Joi.string().required(),
    courtNumber: Joi.number().integer().min(1).max(100),
    scheduledTime: Joi.date().iso(),
    team1Id: Joi.string().uuid().required(),
    team2Id: Joi.string().uuid().required(),
  }),

  update: Joi.object({
    round: Joi.string(),
    courtNumber: Joi.number().integer().min(1).max(100),
    scheduledTime: Joi.date().iso(),
    matchStatus: Joi.string().valid('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED'),
  }).min(1),

  updateScore: Joi.object({
    team1Score: Joi.alternatives().try(
      Joi.object(),
      Joi.array()
    ).required(),
    team2Score: Joi.alternatives().try(
      Joi.object(),
      Joi.array()
    ).required(),
  }),

  complete: Joi.object({
    winnerId: Joi.string().uuid().required(),
  }),
};

module.exports = {
  validate,
  authSchemas,
  tournamentSchemas,
  matchSchemas,
};
