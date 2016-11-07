const { json, send } = require('micro');
module.exports = async function(req, res) {
  const apidoc = await json(req, { limit: '1mb' });
  const schema = apidocToJsonSchema(apidoc);
  send(res, 201, schema);
};

const _ = require('lodash');
const path = require('path');
const pluralize = require('pluralize');

function apidocToJsonSchema(apidoc) {
  return {
    type: 'object',
    oneOf: [
      {
        request: {
          type: 'object',
          oneOf: _.flatten(_.map(apidoc.resources, (resource, resourceName) =>
            resource && resource.operations && resource.operations.map(operation => ({
              properties: {
                [getOperationId(resource, resourceName, operation)]: {
                  description: operation.description,
                  type: 'object',
                  properties: {
                    parameters: operation.parameters && {
                      type: 'object',
                      properties: _.keyBy(operation.parameters.map(parameter => ({
                        name: parameter.name,
                        description: parameter.description,
                        properties: {
                          location: {
                            enum: [parameter.location || (/(GET|DELETE)/.test(operation.method) ? 'query' : 'form')]
                          },
                          value: {
                            type: apiDocTypeToJsonSchema(apidoc, parameter.type)
                          }
                        }
                      })), parameter => parameter.name),
                      required: operation.parameters
                        .filter(parameter => parameter.required !== false)
                        .map(parameter => parameter.name)
                    },
                    body: operation.body && {
                      description: operation.body.description,
                      type: apiDocTypeToJsonSchema(apidoc, operation.body.type)
                    },
                    required: _.compact([
                      operation.body ? 'body' : '',
                      operation.parameters ? 'parameters' : ''
                    ])
                  }
                },
                additionalProperties: false
              }
            }))
          ))
        }
      }
    ],
    definitions: {
      models: apidoc.models && _.keyBy(
        _.map(apidoc.models, (model, name) =>
          Object.assign({
            name: name
          }, apiDocTypeToJsonSchema(apidoc, model))
        ), model => model.name),
      enums: apidoc.enums && _.keyBy(
        _.map(apidoc.enums, (enumType, name) =>
          Object.assign({
            name: name
          }, apiDocTypeToJsonSchema(apidoc, enumType))
        ), enumType => enumType.name)
    }
  };
}

function getOperationId(resource, resourceName, operation) {
  return `[${(operation.method || 'GET ')}] ` +
    path.join(resource.path || pluralize(resourceName),
    operation.path || '.');
}

function apiDocTypeToJsonSchema(apidoc, type) {
  if (typeof type === 'object') {
    if (type.fields) {
      return {
        type: 'object',
        description: type.description,
        required: type.fields
          .filter(field => field.required !== false)
          .map(field => field.name),
        properties: _.keyBy(type.fields.map(field => ({
          name: field.name,
          type: apiDocTypeToJsonSchema(apidoc, field.type)
        })), field => field.name)
      };
    }
    if (type.values) {
      return {
        description: type.description,
        enum: type.values.map(value => value.name)
      };
    }
  }

  if (typeof type !== 'string') {
    throw new Error(`invalid type: ${type}`);
  }

  let arrayDef = /^(map)?\[(.*)]$/.exec(type);
  if (arrayDef) {
    return {
      type: arrayDef[0] === 'map' ? 'object' : 'array',
      items: apiDocTypeToJsonSchema(apidoc, arrayDef[2])
    };
  }
  switch (type) {
    case 'object':
    case 'boolean':
    case 'string':
      return {
        type: type
      };
    case 'unit':
      return {
        type: 'null'
      };
    case 'integer':
    case 'long':
    case 'decimal':
    case 'double':
      return {
        type: 'number'
      };
    case 'uuid':
      // eg. 5ecf6502-e532-4738-aad5-7ac9701251dd
      return {
        type: 'string',
        pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      };
    case 'date-iso8601':
    case 'date-time-iso8601':
      return {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}'
      };
  }

  if (apidoc.models[type]) {
    return {
      '$ref': `#/definitions/models/${type}`
    };
  }

  if (apidoc.enums[type]) {
    return {
      '$ref': `#/definitions/enums/${type}`
    };
  }

  // it might be on imports (not supported yet)
  return {
    description: `WARNING: type not found: ${type}`
  };
}
