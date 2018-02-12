var expect = require("chai").expect;
var jadb = require("../lib/Database");

describe("Select", () =>  {
	var db;
	const itemsToInsert = [
		{"color": "green", "order":"f", "order2":"a"},
		{"color": "blue", "order":"b", "order2":"B"},
		{"color": "yellow", "order":"c", "order2":"a"},
		{"color": "yellow", "order":"d", "order2":"B"},
		{"color": "brown", "order":"e", "order2":"a"},
		{"color": "yellow", "order":"g", "order2":"B"},
		{"color": "yellow", "order":"h", "order2":"a"},
		{"color": "yellow", "order":"i", "order2":"B","xtra":"yes"},
		{"color": "yellow", "order":"a", "order2":"a","xtra":"jupp"}
	];

	describe("Init select", () =>  {

		it("create instance", () =>  {
			db = new jadb();
		});

		it("create empty table", () =>  {
			return db.create("select")
				.then((result) => expect(result).to.be.true)
				.then(() => db.truncate("select"))
				.then((result) => expect(result).to.be.true);
		});

		it("insert many entries", () =>  {


			return db.insert("select", itemsToInsert)
				.then((items) => {
					items.forEach((item, idx) => {
						expect(item.color).to.equal(itemsToInsert[idx].color);
						expect(item).to.have.property("_id").that.is.a('number');
					});
				});
		});


	});

	describe("Simple select queries", () =>  {

		it("find all entries", () =>  {
			return db.all("select")
				.then((item) => expect(item).to.be.an('array').to.have.lengthOf(itemsToInsert.length));
		});

		it("find entry 1 by _id", () =>  {
			return db.find("select", 1)
				.then((item) => expect(item).to.have.property('_id').that.is.a('number').to.equal(1));
		});


	});

	describe("Select queries with where clauses", () =>  {
		it("select entry 4 by _id", () =>  {
			return db.select("select", {"field": "_id", "value": 4})
				.then((items) => {
					expect(items).to.be.an('array').to.have.lengthOf(1)
					expect(items[0]).to.have.property('_id').that.is.a('number').to.equal(4)
				});
		});

		it("select by or: 2 entries by _id", () =>  {
			return db.select("select", [{"field": "_id", "value": 4}, "|", {"field": "_id", "value": 1}])
				.then((items) => expect(items).to.be.an('array').to.have.lengthOf(2));
		});

		it("select by or and comparison operators: 2 entries by _id", () =>  {
			return db.select("select",
				[
					{"field": "_id", "op": ">", "value": 3},
					"&",
					{"field": "_id", "op": "<", "value": 5}
				])
				.then((items) => {
					expect(items).to.be.an('array').to.have.lengthOf(1)
					expect(items[0]).to.have.property('_id').that.is.a('number').to.equal(4)
				});
		});

		it("select combinations: 2 entries by _id or xtra field set", () =>  {
			return db.select("select",
				[
					[{"field": "_id", "op": ">", "value": 1}, "&&", {"field": "_id", "op": "<", "value": 3}],
					"||",
					[{"field": "xtra", "op": "=", "value": "yes"}, "||", {"field": "xtra", "op": "=", "value": "jupp"}]
				]
			)
				.then((items) => {
					expect(items).to.be.an('array').to.have.lengthOf(3);
					const hasId = !!items.find((item) => item._id === 2);
					const hasExtraYes = !!items.find((item) => item.xtra === "yes");
					const hasExtraJupp = !!items.find((item) => item.xtra === "jupp");
					expect(hasId, "searching id 1").to.be.true;
					expect(hasExtraYes, "searching xtra yes").to.be.true;
					expect(hasExtraJupp, "searching xtra jupp").to.be.true;
				});
		});

		it("select using string functions", () => {
			return db.select("select",
					[{"field": "xtra", "op": "defined"}, "||", [
						{"field": "color", "op": "starts", "value": "bro"},
						"&&",
						{"field": "color","op": "ends","value": "wn"}]
					]
				)
				.then((items) => {
					expect(items).to.be.an('array').to.have.lengthOf(3);
				});
		});
	});

	describe("Select queries with order", () =>  {
		it("ordering - asc/default", () => {
			return db.select("select","", {"field":"order"})
				.then((items) => {
					expect(items).to.be.an('array');

					let str ="";
					items.forEach((item) =>str+=item.order)

					expect(str).to.equal("abcdefghi");
				});
		});
		it("ordering - desc", () => {
			return db.select("select","", {"field":"order", "dir":"desc"})
				.then((items) => {
					expect(items).to.be.an('array');

					let str ="";
					items.forEach((item) =>str+=item.order)

					expect(str).to.equal("ihgfedcba");
				});
		});
		it("ordering - by two fields", () => {
			return db.select("select","", [{"field":"order2"},{"field":"order","dir":"desc"}])
				.then((items) => {
					expect(items).to.be.an('array');

					let str ="";
					items.forEach((item) =>{
						str+=" "+item.order2+"."+item.order;

					})
					expect(str).to.equal(" B.i B.g B.d B.b a.h a.f a.e a.c a.a");
				});
		});

		it("ordering - by two fields and ignorecase", () => {
			return db.select("select","", [{"field":"order2","ignorecase":true},{"field":"order","dir":"desc"}])
				.then((items) => {
					expect(items).to.be.an('array');

					let str ="";
					items.forEach((item) =>{
						str+=" "+item.order2+"."+item.order;

					})
					expect(str).to.equal(" a.h a.f a.e a.c a.a B.i B.g B.d B.b");
				});
		});
	});
});