/*
 * SQL wrapper by Gleb Devyatkin (sovgvd@gmail.com) 
*/
'use strict';

var SQLDBhandler = require('mysql');
const suuid = require('uuid/v4');

var sqldb = function () {
	this.client = false;
	this.sequences = {};
	
	this.init = function (_config) {
		this.client = SQLDBhandler.createConnection({ host: _config.host, user: _config.user, password: _config.password, database: _config.db, charset: "UTF8", multipleStatements: true });
	}
	this.escape = function (v) {
		return this.client.escape(v);
	}
	
	this.querySequence = function (data,_callbackSuccess,_callbackFailed) {
		var qsid=suuid();
		// add transaction query
		this.sequences[qsid]={q:data.q, out:data.out, transaction:false, error:false, ids:{}, success: _callbackSuccess, failed: _callbackFailed};
		this.doQuerySequence(qsid);
	}
	
	this.doQuerySequence = function (id, err, result, fields) {
		if (this.sequences[id].q.length>0) {
			if (this.sequences[id].transaction===false) {
				var q={q:"SET autocommit=0; START TRANSACTION;", qid:false};
				this.sequences[id].transaction=true;
			} else {
				var q=this.sequences[id].q.shift();
			}
			this.client.query( q.q, null, function(id, qid, err, result, fields) {
				if (err) {
					if (err.code=='ER_DUP_ENTRY') { 
						this.sequences[id].error = 'already_exists'; 
					} else {
						//console.log("SQL ERROR", err);
						this.sequences[id].error="internal_error";
					}
					if (this.sequences[id].transaction) {
						this.doQuerySequence_rollback(id);
					}
				} else {
					if (result[0] && result[0].APIprecheck) {
						if (result[0].APIprecheck=='n') {
							this.sequences[id].error="access_denied";
							if (this.sequences[id].transaction) {
								this.doQuerySequence_rollback(id);
							}
						} else {
							this.doQuerySequence(id);
						}
					} else if (qid!==false) {
						if (result.insertId) {
							this.sequences[id].ids[qid]=result.insertId;
						}
						for (var i in this.sequences[id].q) { 
							if (this.sequences[id].q[i].q) {
								for (var ii in this.sequences[id].ids) {
									var regex = new RegExp("\\_insertID\\."+ii, "g");
									this.sequences[id].q[i].q=this.sequences[id].q[i].q.replace(regex,this.sequences[id].ids[ii]);
								}
							}
						}
						this.doQuerySequence(id);
					} else {
						this.doQuerySequence(id);
					}
				}
			}.bind(this,id,q.qid));
		} else {
			this.doQuerySequence_commit(id);
		}
	}
	this.doQuerySequence_rollback = function (id) {
		this.client.query("ROLLBACK; SET autocommit=1;", null, function (id, err, result, fields) {
			this.sequences[id].failed(this.sequences[id].error);
			delete this.sequences[id];
		}.bind(this,id));
	}

	this.doQuerySequence_commit = function (id) {
		this.client.query("COMMIT; SET autocommit=1;", null, function (id, err, result, fields) {
			var out={};
			for (var i in this.sequences[id].out) {
				if (this.sequences[id].ids[(this.sequences[id].out[i])]) {
					out[i]=this.sequences[id].ids[(this.sequences[id].out[i])];
				} else if (i.indexOf("_asis_-")===0) {
					out[i.substr(7)]=this.sequences[id].out[i]
				}
			}
			this.sequences[id].success(out);
			delete this.sequences[id];
		}.bind(this,id));
	}

	
	this.query = function (q,_callback) {
		//SQL_CALC_FOUND_ROWS for mysql
		var extra={
			records: false,
			limit: 0,
			offset: 0,
			order: false
		};
		if (q.q.toLowerCase().indexOf('select ')==0 && q.q.toUpperCase().indexOf('SQL_CALC_FOUND_ROWS')==-1) {
			extra.records=true;
			if (q.q.toLowerCase().indexOf(' limit ')!=-1) {
				var tmp=q.q.toLowerCase().split(' limit '); tmp=tmp[1];
				if (tmp.indexOf(",")!=-1) {
					tmp=tmp.split(",");
					extra.offset = parseInt(tmp[0]);
					extra.limit = parseInt(tmp[1]);
				} else {
					extra.limit = parseInt(tmp);
				}
			}
			if (q.q.toLowerCase().indexOf(' offset ')!=-1) {
				var tmp=q.q.toLowerCase().split(' offset ');
				extra.offset = parseInt(tmp[1]);
			}
			if (q.q.toLowerCase().indexOf(' order by ')!=-1) {
				var tmp=q.q.toLowerCase().split(' order by ');
					tmp=tmp[1].split(" ");
					if (tmp[1]) {
						extra.order=tmp[1].toLowerCase().indexOf("desc")!=-1?'DESC':'ASC';
					}
			}
			q.q=q.q.substr(0,7)+"SQL_CALC_FOUND_ROWS"+q.q.substr(6);
		}
		this.client.query( q.q, q.d, function(_callback, extra, err, result, fields) {
			if (err) {
				//console.log("SQL ERROR", err);
				_callback(false,false);
			} else {
				if (extra.records) {
					this.client.query("SELECT FOUND_ROWS() r", null, function(_callback, extra, mresult, mresult_insertId, err, result, fields) {
						if (err) {
							//console.log("SQL ERROR", err);
						} else {
							result=JSON.parse(JSON.stringify(result));
							extra.records=result[0].r;
						}
						mresult=JSON.parse(JSON.stringify(mresult));
						_callback(mresult, mresult_insertId, extra);
					}.bind(this,_callback, extra, result, result.insertId));
				} else {
					result=JSON.parse(JSON.stringify(result));
					_callback(result, result.insertId, false);
				}
			}
		}.bind(this,_callback, extra));
	}
}
module.exports = sqldb;
