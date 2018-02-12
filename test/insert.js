var expect = require("chai").expect;
var jadb = require("../lib/Database");

const tablename = "insert";
const relatedTablename = "related";

describe("Inserting and deleting data", function () {
	var db;
	describe("Creating insert database", function () {
		it("create instance", function () {
			db = new jadb();
		});

		it("create tables", function () {
			return db.create(tablename)
				.then((result) => expect(result).to.be.true)
				.then(() => db.create(relatedTablename))
				.then((result) => expect(result).to.be.true);
		});
		it("truncate tables", function () {
			return db.truncate(tablename)
				.then((result) => expect(result).to.be.true)
				.then(() => db.truncate(relatedTablename))
				.then((result) => expect(result).to.be.true);
		});
	});

	describe("inserting data", function () {
		const itemsToInsert = [{"color": "green"}, {"color": "blue"}, {"color": "red"}, {"color": "yellow"},
			{"color": "green"}, {"color": "yellow"}, {"color": "yellow"}, {"color": "yellow"},
			{"color": "blue"}, {"color": "yellow"}, {"color": "yellow"}];

		const relatedItemsToInsert = [
			{"kind": "#1 related to id 1", "idrel": tablename+"~1", "orel": tablename+"~1"},
			{"kind": "#2 related to id 1", "idrel": tablename+"~1", "orel": tablename+"~1"},
			{"kind": "#3 related to id 1", "idrel": tablename+"~1", "orel": tablename+"~1"},
			{"kind": "#1 related to id 2", "idrel": tablename+"~2", "orel": tablename+"~2"},
			{"kind": "#2 related to id 1", "idrel": tablename+"~2", "orel": tablename+"~2"},
			{"kind": "#3 related to id 2", "idrel": tablename+"~2", "orel": tablename+"~2"},
			{"kind": "#1 related to id 3", "idrel": tablename+"~3", "orel": tablename+"~3"},
			{"kind": "#2 related to id 1", "idrel": tablename+"~3", "orel": tablename+"~3"},
			{"kind": "#3 related to id 2", "idrel": tablename+"~3", "orel": tablename+"~3"}
		];

		it("insert many entries", function () {
			return db.insert(tablename, itemsToInsert)
				.then((items) => {
					items.forEach((item, idx) => {
						expect(item.color).to.equal(itemsToInsert[idx].color);
						expect(item).to.have.property("_id").that.is.a('number');
					});
				})
				.then(() => db.insert(relatedTablename, relatedItemsToInsert)
					.then((relatedItems) => {
						relatedItems.forEach((item, idx) => {
							expect(item.kind).to.equal(relatedItemsToInsert[idx].kind);
							expect(item).to.have.property("_id").that.is.a('number');
						});
					})
				);
		});

		it("find entry by _id=1", function () {
			return db.find(tablename, 1)
				.then((item) => expect(item).to.have.property('_id').that.is.a('number').to.equal(1));
		});

		it("find entry by _id=2", function () {
			return db.find(tablename, 2)
				.then((item) => expect(item).to.have.property('_id').that.is.a('number').to.equal(2));
		});

		it("find entry by _id=3", function () {
			return db.find(tablename, 3)
				.then((item) => expect(item).to.have.property('_id').that.is.a('number').to.equal(3));
		});
	});

	describe("deleting data", function () {

		it("delete entry with id=4", function () {
			return db.find(tablename, 4)
				.then((item) => expect(item).to.have.property('_id').that.is.a('number').to.equal(4))
				.then(() => db.deleteItem(tablename, 4))
				.then((result) => expect(result).to.be.true);
		});

		it("delete entry with color=yellow", function () {
			return db.delete(tablename, {"field": "color", "value": "yellow"})
				.then((result) => expect(result).to.be.true)
				.then(() => db.select(tablename, {"field": "color", "value": "yellow"}))
				.then((items) => expect(items).to.be.an('array').that.is.empty)
		});

		it("delete entry with id=1 and unset relations", function () {
			return db.find(tablename, 1)
				.then((item) => expect(item, "ensure existing entry").to.have.property('_id').that.is.a('number').to.equal(1))
				.then(() => db.deleteItemRelated(tablename, 1,
					{"table": relatedTablename, "field": "idrel"}
				))
				.then((result) => expect(result).to.be.an('array').to.not.contain(false))
				.then(() => db.select(relatedTablename, {"field": "idrel", "value": tablename+"~1"}))
				.then((items) => expect(items).to.be.an('array').that.is.empty)
				.then(() => db.select(relatedTablename, {"field": "orel", "value": tablename+"~1"}))
				.then((items) => expect(items).to.be.an('array').to.have.lengthOf(3))
		});

		it("delete entry with id=2 and delete relations", function () {
			return db.find(tablename, 2)
				.then((item) => expect(item, "ensure existing entry").to.have.property('_id').that.is.a('number').to.equal(2))
				.then(() => db.deleteItemRelated(tablename, 2,
					{"table": relatedTablename, "field": "idrel", "delete": true}
				))
				.then((result) => expect(result).to.be.an('array').to.not.contain(false))
				.then(() => db.select(relatedTablename, {"field": "idrel", "value": tablename+"~2"}))
				.then((items) => expect(items).to.be.an('array').that.is.empty)
				.then(() => db.select(relatedTablename, {"field": "orel", "value": tablename+"~2"}))
				.then((items) => expect(items).to.be.an('array').that.is.empty)
				.then(() => db.all(relatedTablename))
				.then((items) => expect(items, "table still has relations").to.be.an('array').to.have.lengthOf(6))
		});

		it("delete entry with id=3 and delete relations using where", function () {
			let itemid;
			return db.select(tablename, {"field":"color", "value": "red"})
				.then((items) => {
					expect(items, "ensure existing entry").to.be.an('array').to.have.lengthOf(1);
					itemid = items[0]._id;
				})
				.then(() => db.deleteRelated(tablename,
					{"field":"color", "value": "red"},
					{"table": relatedTablename, "field": "idrel", "delete": true}
				))
				.then((result) => expect(result).to.be.an('array').to.not.contain(false))
				.then(() => db.select(relatedTablename, {"field": "idrel", "value": tablename+"~"+itemid}))
				.then((items) => expect(items, "relations to "+itemid+" deleted").to.be.an('array').that.is.empty)
				.then(() => db.select(relatedTablename, {"field": "orel", "value": tablename+"~"+itemid}))
				.then((items) => expect(items, "relations to "+itemid+" deleted/2").to.be.an('array').that.is.empty)
				.then(() => db.all(relatedTablename))
				.then((items) => expect(items, "table still has any relations ").to.be.an('array').to.have.lengthOf(3))
		});
	});
});
