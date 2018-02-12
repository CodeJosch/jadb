var expect = require("chai").expect;
var jadb = require("../lib/Database");

describe("Update", function () {
	var db;
	describe("Init update table", function () {
		it("create instance", function () {
			db = new jadb();
		});

		it("create empty table", function () {
			return db.create("update")

				.then((result) => {
					expect(result).to.be.true
					return db.truncate("update")
				})
				.then((result) => expect(result).to.be.true);
		});


		it("insert many", function () {
			const itemsToInsert = [
				{"color": "green"},
				{"color": "blue"},
				{"color": "yellow"},
				{"color": "yellow"},
				{"color": "brown"},
				{"color": "yellow"},
				{"color": "yellow"},
				{"color": "yellow", "xtra": "yes"},
				{"color": "yellow", "xtra": "jupp"}
			];

			return db.insert("update", itemsToInsert)
				.then((items) => {
					items.forEach((item, idx) => {
						expect(item.color).to.equal(itemsToInsert[idx].color);
						expect(item).to.have.property("_id").that.is.a('number');
					});

				});
		});


	});

	describe("Queries", function () {


		it("update by id", function () {
			return db.updateItem("update", 1, {"color":"black"})
				.then(() => db.find("update", 1))
				.then((item) => {
					expect(item).to.have.property('_id').that.is.a('number').to.equal(1)
					expect(item).to.have.property('color').that.is.a('string').to.equal("black")
				});
		});
		it("update by field", function () {
			return db.update("update", {"field":"xtra","op":"defined"}, {"color":"orange"})
				.then(() => db.select("update", {"field":"color","op":"=","value":"orange"}))
				.then((items) => {
					expect(items).to.be.an('array').to.have.lengthOf(2)

				});
		});
	});
});