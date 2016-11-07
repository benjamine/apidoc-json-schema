apidoc-json-schema
==================

Uses an [apidoc.json](http://apidoc.me/doc) to generate a [JSON-schema](http://json-schema.org/) that can be used to validate requests to your API (both client or sever-side) using any [json-schema validator](http://json-schema.org/implementations.html).

Usage
-----

Start the app:

``` sh
npm i && npm start
```

Or deploy to the cloud using [now](https://now.sh):
``` sh
npm i && npm run now
```

POST an apidoc.json file and get your json-schema:

``` sh
curl -X POST http://localhost:3000 --data-binary @./apidoc.json > jsonschema.json
```

Now you can use that schema to validate your requests by expressing each request as:

``` json
{
  "request": {
    "[VERB] full/operation/path": {
      "parameters": {
        "param1": {
          "location": "form",
          "value": "somevalue"
        }
      },
      "body": {
        "value": {
          "yourbody": "values"
        }
      }
    }
  }
}
```

and use [a validator that works for your stack](http://json-schema.org/implementations.html)

Here's an example in node.js (express.js middleware):

``` js
import Ajv from 'ajv'; // using https://github.com/epoberezkin/ajv
const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}
import { * as _ } from 'lodash';

function validateMiddleware(app) {
  const schema = require('./jsonschema.json');
  const validate = ajv.compile(schema);
  function validate(req, res, next) {
    var valid = validate(reqAsJson(req));
    if (valid) {
      return next();
    }
    res.status(400).send({ errors: validate.errors });
  }
}

function reqAsJson(req) {
  return {
    request: {
      [`[${req.method.toUpperCase()}] ${req.route}`]: {
        parameters: _.keyBy(_.map(req.params, param, name => ({
          name,
          value: param
        })), param => param.name),
        body: {
          value: req.body
        }
      }
    }
  }
}
```

You can go further and get data transform and (type convert and remove unspecified properties, aka whitelisting) using something like: [contracts](https://www.npmjs.com/package/contracts#transforming-data-using-a-schema)
