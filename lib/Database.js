const fs = require("fs-extra");
const path = require("path");
const winston = require('winston');
const moment = require("moment");

const operatorFuncs = {
	"=": (v1, v2) => v1 === v2,
	"<": (v1, v2) => v1 < v2,
	">": (v1, v2) => v1 > v2,
	"<=": (v1, v2) => v1 <= v2,
	">=": (v1, v2) => v1 >= v2,
	"!=": (v1, v2) => v1 !== v2,
	"<>": (v1, v2) => v1 !== v2,
	"starts": (v1, v2) => (v1 + "").startsWith(v2),
	"ends": (v1, v2) => (v1 + "").endsWith(v2),
	"contains": (v1, v2) => (v1 + "").indexOf(v2) >= 0,
	"defined": (v1/*, v2*/) => typeof(v1) !== "undefined"
};

const logicalOperators = {
	"|": "|",
	"||": "|",
	"or": "|",
	"OR": "|",
	"&": "&",
	"and": "&",
	"AND": "&"
};


class Database {

	constructor(options) {

		Object.defineProperty(this, "options", {
			"value": JSON.parse(JSON.stringify(options || {}))
		});

		Object.defineProperty(this, "locks", {
			"value": [],
			"writable": true
		});

		if (!this.options.dir) {
			this.options.dir = "jadb";
		}

		try {
			this.logger = new (winston.Logger)({
				"level": this.options.log || "warn",
				"transports": [
					new (winston.transports.Console)(),
					new (winston.transports.File)({
						"filename": this.options.logfile || path.join(this.options.dir, "ja.log")
					})
				]
			});

			if (!fs.existsSync(this.options.dir)) {
				fs.ensureDirSync(this.options.dir, 0o766);
				this.logger.debug("Created jadb directory " + this.options.dir);
			}
		} catch (e) {
			this.logger.error("Instanciation exception caught, db disfunct - " + e);
			return;
		}
		this.logger.debug("New database instance created", {"info": this.options});
	}

	static timestamp() {
		return moment().format();
	}

	static _itemMatches(item, wheres) {

		if (!Array.isArray(wheres)) {
			wheres = [wheres];
		}

		let ret = true;
		let lastcon = "&";
		wheres.forEach((where) => {
			if (typeof where === "string") {
				lastcon = where;
			} else if (Array.isArray(where)) {
				ret = Database._combineLogical(ret, lastcon, Database._itemMatches(item, where));
			} else {
				let result = (operatorFuncs[where.op] || operatorFuncs["="])(item[where.field], where.value);
				ret = Database._combineLogical(ret, lastcon, result);
			}
		});
		return ret;

	}

	static _filterItems(items, wheres) {
		if (!wheres) {
			return items;
		}
		return items.filter((item) => Database._itemMatches(item, wheres));
	}

	static _orderItems(items, order) {
		if (!order) {
			return items;
		}
		if (!Array.isArray(order)) {
			order = [order];
		}

		const sort = (a, b, dir) => (a > b) ? dir : ( (a < b) ? -dir : 0 ) ;

		return items.sort((a, b) => {
			let ret = 0;
			for (let i = 0, ito = order.length; i < ito; i++) {
				let ord = order[i];
				let avalue = a[ord.field],
					bvalue = b[ord.field];

				if (ord.ignorecase) {
					avalue = (avalue+"").toLocaleLowerCase();
					bvalue = (bvalue+"").toLocaleLowerCase();
				}

				ret = sort(avalue,bvalue, ord.dir === "desc" ? -1 : 1);
				if (ret) return ret;
			}
		});
	}

	static _combineLogical(prev, con, cur) {
		return logicalOperators[con] === "|" ? (prev || cur) : (prev && cur);
	}

	static _limitItems(items, limit) {
		if (!limit) {
			return items;
		}
		let start;
		let end;
		if (typeof limit === "number") {
			start = 0;
			end = start + limit;
		} else {
			start = limit.start || 0;
			end = start + (limit.count || 0);
		}

		return items.slice(start, end);
	}

	static _copyValues2Item(item, values) {
		for (const key in values) {
			if (values.hasOwnProperty(key)) {
				if (["_id", "_modified", "_created"].includes(key)) {
					continue;
				}
				item[key] = values[key];
			}
		}
		item._modified = Database.timestamp();
	}

	static relationValue(table, id) {
		return table + "~" + id;
	}

	filename(table) {
		return path.join(this.options.dir, table) + ".json";
	}

	create(table, mustNotExist) {
		const tableFileName = this.filename(table);
		return fs.pathExists(tableFileName)
			.then((exists) => {
				if (exists) {
					if (mustNotExist) {
						this.logger.info("Table " + table + " already exists.");
						throw(new Error("Table " + table + " already exists."))
					} else {
						this.logger.debug("Database file " + table + " already exists, will not overwrite");
						return true;
					}
				} else {
					const now = Database.timestamp();
					return fs.writeJSON(tableFileName, {
							"maxid": 0,
							"created": now,
							"modified": now,
							"items": []
						})
						.then(() => {
							this.logger.debug("New database file " + tableFileName + " created");
							return true;
						})
						.catch((err) => {
							this.logger.error("Error creating " + table + ": " + err);
							throw err;
						});
				}
			})
	}

	drop(table) {
		const tableFileName = this.filename(table);
		return fs.remove(tableFileName)
			.then(() => {
				this.logger.debug("Deleted table " + table);
				return true;
			})
			.catch((err) => {
				this.logger.error("Error dropping " + table + ": " + err);
				throw err;
			});
	}

	truncate(table) {
		return this.readTable(table, true)
			.then((json) => {
				json.maxid = 0;
				json.modified = Database.timestamp();
				json.items = [];
				return this.writeTable(table, json);
			})
			.catch((err) => {
				this.unlockTable(table);
				this.logger.error("Error truncating " + table + ": " + err);
				throw err;
			});
	}

	unlockTable(table) {
		this.logger.debug("Unlocking " + table);
		this.locks = this.locks.filter((value) => value !== table);
	}

	lockTable(table) {
		this.logger.debug("Locking " + table);
		this.locks.push(table);
	}

	readTable(table, lock) {
		const tableFileName = this.filename(table);

		return new Promise((resolve, reject) => {
			if (this.locks && (this.locks.indexOf(table) >= 0)) {
				this.logger.debug("Table " + table + " locked, delay 50ms");
				setTimeout(() => resolve(this.readTable(table)), 50);
				return;
			}
			if (lock) {
				this.lockTable(table);
			}

			fs.readJson(tableFileName)
				.then((json) => {
					if (!json.items) {
						json.items = [];
					}
					resolve(json);
				})
				.catch(reject);
		});
	}


	writeTable(table, json) {
		const tableFileName = this.filename(table);

		json.modified = Database.timestamp();

		if (!json.items) {
			json.items = [];
		}

		return fs.writeJson(tableFileName, json)
			.then(() => {
				this.unlockTable(table);
				return true;
			});
	}

	all(table) {
		return this.readTable(table)
			.then((json) => json.items);
	}

	find(table, id) {
		return this.readTable(table)
			.then((json) => json.items.find((item) => item._id === id));
	}

	filter(filter, cb) {
		return this.readTable(table)
			.then((json) => json.items.filter((item) => cb(item, json.items)));
	}

	select(table, wheres, order, limit) {
		return this.all(table)
			.then((items) => Database._filterItems(items, wheres))
			.then((items) => Database._orderItems(items, order))
			.then((items) => Database._limitItems(items, limit))
			.catch((err) => {
				this.logger.error("Select (" + table + "," +
					JSON.stringify(wheres || "<no where>") + ", " +
					JSON.stringify(order || "<no order>") + ", " +
					JSON.stringify(limit || "<no limit>") + ") failed : " + err);
				throw err;
			});
	}

	update(table, wheres, values) {
		let ret = [];
		return this.readTable(table, true)
			.then((json) => {
				json.items.forEach((item) => {
					if (Database._itemMatches(item, wheres)) {
						Database._copyValues2Item(item, values);
						ret.push(item);
					}
				});
				return this.writeTable(table, json);
			})
			.then(() => ret)
			.catch((err) => {
				this.unlockTable(table);
				this.logger.error("Update (" + table + "," +
					JSON.stringify(wheres || "<no where>") + ", " +
					JSON.stringify(values || "<no values>") + ") failed : " + err);
				throw err;
			});
	}

	updateItem(table, id, values) {
		return this.update(table, {"field":"_id", "value":id}, values);
	}

	delete(table, wheres) {
		return this.readTable(table, true)
			.then((json) => {
				json.items = json.items.filter((item) => !Database._itemMatches(item, wheres));
				return this.writeTable(table, json);
			})
			.then(() => true)
			.catch((err) => {
				this.unlockTable(table);
				this.logger.error("Delete (" + table + "," +
					JSON.stringify(wheres || "<no where>") + ") failed : " + err);
				throw err;
			});
	}

	deleteItem(table, id) {
		return this.delete(table, {"field":"_id", "value":id});
	}

	_deleteRelationsUnset(deletedIds, relationTable, field) {
		return this.readTable(relationTable, true)
			.then((relatedJson) => {

				deletedIds.forEach((deleted) =>
					relatedJson.items.forEach((relatedItem) => {
						if (Array.isArray(relatedItem[field])) {
							relatedItem[field] = relatedItem[field].filter((relatedId) => relatedId !== deleted);
						} else if (relatedItem[field] === deleted) {
							delete relatedItem[field];
						}
					})
				);

				return this.writeTable(relationTable, relatedJson);
			})
			.catch((err) => {
				this.unlockTable(relationTable);
				throw err;
			});
	}

	_deleteRelationsCascade(deletedIds, relationTable, field) {
		return this.readTable(relationTable, true)
			.then((relatedJson) => {
				deletedIds.forEach((deleted) =>
					relatedJson.items = relatedJson.items.filter((relatedItem) => {
						if (Array.isArray(relatedItem[field])) {
							relatedItem[field] = relatedItem[field].filter((relatedId) => relatedId !== deleted);
							return !!relatedItem[field].length;
						}
						return (relatedItem[field] !== deleted);
					})
				);

				return this.writeTable(relationTable, relatedJson);
			})
			.catch((err) => {
				this.unlockTable(relationTable);
				throw err;
			})
	}

	_deleteRelations(deletedIds, relations) {
		let proms = [];

		if (!Array.isArray(relations)) {
			relations = [relations];
		}

		relations.forEach((relation) =>
			proms.push(
				relation.delete
					? this._deleteRelationsCascade(deletedIds, relation.table, relation.field)
					: this._deleteRelationsUnset(deletedIds, relation.table, relation.field)
			)
		);

		return Promise.all(proms);
	}

	deleteRelated(table, wheres, relations) {
		return this.readTable(table, true)
			.then((json) => {
				let deletedIds = [];
				json.items = json.items.filter((item) => {
					if (Database._itemMatches(item, wheres)) {
						deletedIds.push(Database.relationValue(table, item._id));
						return false;
					} else {
						return true;
					}
				});
				return this.writeTable(table, json)
					.then(() => this._deleteRelations(deletedIds, relations));
			})
			.catch((err) => {
				this.unlockTable(table);
				this.logger.error("Delete related (" + table + "," +
					JSON.stringify(wheres || "<no where>") + ", " +
					JSON.stringify(relations || "<no relations>") + ") failed : " + err);
				throw err;
			});
	}

	deleteItemRelated(table, id, relations) {
		return this.deleteRelated(table, {"field":"_id", "value":id}, relations);
	}

	insert(table, items) {
		return this.readTable(table, true)
			.then((json) => {
				const now = Database.timestamp();

				items.forEach((item) => {
					item._created = item._modified = now;
					item._id = ++json.maxid;
					json.items.push(item);
				});

				return this.writeTable(table, json)
					.then(() => items);
			})
			.catch((err) => {
				this.unlockTable(table);
				this.logger.error("Insert (" + table + "," +
					JSON.stringify(items || "<no items>") + ") failed : " + err);
				throw err;
			});
	}

	insertItem(table, item) {
		return this.insert(table, [item]);
	}
}

module.exports = Database;
