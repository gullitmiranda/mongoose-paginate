'use strict';

/**
 * @package mongoose-paginate
 * @param {Object} [query={}]
 * @param {Object} [options={}]
 * @param {Object|String} [options.select]
 * @param {Object|String} [options.sort]
 * @param {Array|Object|String} [options.populate]
 * @param {Boolean} [options.lean=false]
 * @param {Boolean} [options.leanWithId=true]
 * @param {Number} [options.offset=0] - Use offset or page to set skip position
 * @param {Number} [options.page=1]
 * @param {Number} [options.limit=10]
 * @param {Function} [callback]
 * @returns {Promise}
 */

function paginate(query, options, callback) {
  query = query || {};
  options = Object.assign({}, paginate.options, options);

  const {
    sort,
    limit = 10,
  } = options;

  let select     = options.select;
  let populate   = options.populate;
  let lean       = options.lean || false;
  let leanWithId = options.leanWithId ? options.leanWithId : true;
  let page, offset, skip;
  let docsQuery, countQuery, promises;

  if (options.offset) {
    offset = options.offset;
    skip = offset;
  } else if (options.page) {
    page = options.page;
    skip = (page - 1) * limit;
  } else {
    page = 1;
    offset = 0;
    skip = offset;
  }

  if (limit) {
    if (typeof query === 'object' && query._pipeline) {
      docsQuery  = this.aggregate(query._pipeline);
      countQuery = this.aggregate(query._pipeline).group({ _id: null, count: { $sum: 1 } });
    } else {
      docsQuery  = this
        .find(query)
        .select(select)
        .lean(lean)
        ;
      countQuery = this.count(query);
    }

    docsQuery = docsQuery
      .skip(skip)
      .limit(limit);

    if (sort) {
      docsQuery = docsQuery.sort(sort);
    }

    if (populate) {
      [].concat(populate).forEach((item) => {
        docsQuery.populate(item);
      });
    }

    promises = [
      docsQuery.exec(),
      countQuery.exec(),
    ];
  }

  return Promise.all(promises).then(([ docs = [], total = 0 ]) => {
    if (countQuery._pipeline) {
      total = (total.length === 0) ? 0 : total[0].count;
    }

    if (lean && leanWithId) {
      docs = docs.map((doc) => {
        doc.id = String(doc._id);
        return doc;
      });
    }

    const result = {
      docs,
      total,
      limit,
    };

    if (offset !== undefined) {
      result.offset = offset;
    }

    if (page !== undefined) {
      result.page = page;
      result.pages = Math.ceil(total / limit) || 1;
    }

    if (typeof callback === 'function') {
      return callback(null, result);
    }

    const promise = new Promise();
    promise.resolve(result);
    return promise;
  });
}

/**
 * @param {Schema} schema
 */

module.exports = function(schema) {
  schema.statics.paginate = paginate;
};

module.exports.paginate = paginate;
