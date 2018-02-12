var expect = require("chai").expect;
var jadb = require("../lib/Database");

const tablename = "banyan";

describe("Basic Database", function () {
	var db;

	describe("Instanciating", function () {

		it("create instance", function () {
			db = new jadb();
		});

	});

	describe("Creating tables", function () {

		it("create table", function () {
			return db.create(tablename)
				.then((result) => expect(result).to.be.true);
		});

		it("create table using implicit if not exists", function () {
			return db.create(tablename)
				.then((result) => expect(result).to.be.true);
		});

		it("create table fail if it already exists by forcing must not exist", function () {
			return db.create(tablename, true)
				.catch((err) => expect("" + err).to.equal("Error: Table " + tablename + " already exists."));
		});

	});

	describe("Locking", function () {

		it("lock and release " + tablename, function () {
			return db.readTable(tablename, true)
				.then(() => {
					setTimeout(() => {
						db.unlockTable(tablename)
					}, 1000);
					return db.all(tablename)
						.then((items) => expect(items).to.be.an('array').to.be.empty);
				});
		});

	});

	describe("Dropping", function () {

		it("drop table " + tablename, function () {
			return db.drop(tablename)
				.then((result) => expect(result).to.be.true);
		});

	});

});
