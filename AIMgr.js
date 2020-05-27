window.AcJs_get = function (type, JsonStr) {
    if (window.android != undefined) {
        window.android.AcJs_get(type, JsonStr);
    }
}

var TYPE_CLINT = 0;//不需要解析过滤,直接发给H5的初始化的一些信息
var TYPE_TOH5 = 1;//需要解析处理后,发给H5的信息(SVC发的消息)
var TYPE_FROMH5 = 2;//H5给客户端返回的一些信息
var TYPE_QUESTION = 3;//记录的题型对应的答案数据（后期优化后可能不需要进行解析，直接通过教材获得星星就可以了）
var TYPE_TOH5_FIX = 4;//某些自动回复的数据，需要录制时就要做标记，解析时直接过滤对应标识

const GET_HANDLE_MESSAGE = "getHandleMessage()";

var isInitStar = false;
var mCurPage = -1;//当前页码
var mUsingPaintBrush = false;//是否授权画笔
var mStarAdd = 1;//默认增加的星星数
//需要替换的源字符串数据
var mSrcArray = [];
var mDstArray = [];
var mCurStar;//当前自己的星星数
var mStarData;

function AIScriptItem(acTime, type, head, jsonStr) {
    this.acTime = acTime;
    this.type = type;
    this.head = head;
    this.jsonStr = jsonStr;
    this.next = this;
}

function start(uid, courseId) {
    _log("uid="+uid+", courseId="+courseId);
    mDstArray[0] = uid;
    mDstArray[1] = courseId;
    //1.loader 脚本
    //2.抛最后一条数据到上层，作为判断课程是否结束的数据依据
    //3.获取初始的"starData"数据
    //4.获取初始的"notifyData"数据
    //5.开始循环处理脚本数据

    //TODO 1.loader 脚本,这里要考虑是否通知上层客户端开始解析脚本
    //TODO 2.抛最后一条数据到上层，作为判断课程是否结束的数据依据，这里属于业务，客户端自己处理就行
    //3.获取初始的"starData"数据
    getStarData();
    //4.获取初始的"notifyData"数据
    getNotifyData();
    //5.开始循环处理脚本数据
    postNext(0);
}

function getStarData() {

}


function getNotifyData() {

}

function postNext(ms) {
    _log("postNext >>> " + ms);
    clearTimeout(GET_HANDLE_MESSAGE)
    setTimeout(GET_HANDLE_MESSAGE, ms);
}

//从客户端获取对应的item数据，下条item数据的时间间隔
function getHandleMessage() {
    _log("getHandleMessage >>> ");
    aiH5ToC("getItemData")
    _log("getHandleMessage >>> 1");
}


function handleMessage(itemJson, ms) {
    _log("读取一条数据")
    var bean = null;
    if(typeof(itemJson) == "String"){
        bean = JSON.parse(itemJson);
    }else{
        bean = itemJson;
    }
    var pageBean = null;
    while (bean != null) {
        _log("handleMessage time=" + ms + ", type=" + bean.type + ", actime=" + bean.acTime + ", head=" + bean.head + ", json=" + bean.jsonStr);
        if (bean.type == TYPE_TOH5) {
            if (bean.type == "memberChange") {
                handleMemberChange(bean)
            }
            if (bean.head == "pageData") {
                //翻页动作只做一次
                pageBean = new AIScriptItem(bean.acTime, bean.type, bean.head, bean.jsonStr);
            } else if (bean.head == "wbData") {
                makeWbData(bean);
            } else {
                handleToH5(bean.acTime, bean.head, bean.jsonStr);
            }
        } else if (bean.type == TYPE_CLINT) {
            if (bean.head == "init") {
                handleInit(bean);
            } else {
                toH5(bean.type, bean.jsonStr);
            }
        } else if (bean.type == TYPE_QUESTION) {

        } else {

        }
        bean = bean.next;
        if (bean == null && pageBean != null) {
            //刚进入教室时，翻页只做一次
            _log("刚进入教室时，翻页只做一次");
            handleToH5(pageBean.actime, pageBean.head, pageBean.jsonStr);
            if (!isInitStar) {
                isInitStar = true;
                aiH5ToC("initStar", h5ToCData);
            }
        }
    }
    if (ms <= 0) {
        _log("已经没有Item数据了")
    }
    postNext(ms);
}

//脚本文件中的某些数据需要处理后再toH5
function handleToH5(acTime, type, dataJson) {
    var jsonBean = JSON.parse(dataJson);
    if (type == "pageData") {
        mCurPage = jsonBean.curPage;
        endQT()
    } else if (type == "gSetData") {
        //待定，是否需要做题状态
        for (let i = 0; i < jsonBean.data.size; i++) {
            var data = jsonBean.data[i];
            if (data.key == "classStatus") {
                //普通答题
                if (item.value == "2") {
                    //授权
//                    beginQT();
                } else {
                    //授权结束
//                    endQT();
                }
                break;
            } else if (data.key == "openWbToolAuthority") {
                //给学生画笔的授权
                if (item.value == "1") {
                    //授权
                    mUsingPaintBrush = true;
                } else {
                    //授权结束
                    mUsingPaintBrush = false;
                }
                break;
            }
        }
    } else if (type == "clData") {
        if (dataJson.indexOf("teaShowResult")) {
            //如果是老师判断对错，就不要发给H5
            return;
        }
    } else if (type == "starData") {
        mStarData = jsonBean;
    } else if (type == "notifyData") {
        var item = jsonBean.notifyData;
        if (item.cmd == "starData") {
            //如果星星消息，去掉自己，如果没有其他人信息，就不要发给H5
            item = item.data.value;
            var senderID = item.senderID;
            var starType = item.starType;
            mStarAdd = item.starAdd;
            var receivers = item.receivers;
            var index = -1;
            var newReceivers = [];
            //1.开始检查发星星数据中是否包含自己的id，如果有则先删除
            //2.如果群发中有自己的则给自己发星星操作
            for (let i = 0; i < receivers.length; i++) {
                //1.查询是否包含自己
                //2.把所有非自己的数据放到新的数组中
                if (receivers[i] == mSrcArray[0]) {
                    index = i;
                } else {
                    newReceivers[i] = receivers[i];
                }
            }
            if (index != -1) {
                mCurStar++;
                item.receivers = newReceivers;
            }
            if (receivers.length == 0) {
                //发星星数组==0，不用走后面的逻辑，直接return
                _log("receivers.length == 0")
                return;
            }
            if (index != -1) {
                //给自己发星星操作
                var selfReceivers = [mDstArray[0]];
                sendStarToUI(selfReceivers, senderID, starType, mStarAdd, acTime, 2);
            }
            if (replaceSelfStar(mStarData)) {
                toH5(type, JSON.stringify(mStarData))
            }
            sendStarToUI(receivers, starType, starType, mStarAdd, acTime, 2);
        }
    }
    toH5(type, data);
}

//替换自己的星星信息
function replaceSelfStar(starData) {
    var value = starData.value;
    var data = starData.data;
    if (data == null || data.length == 0) {
        return false;
    }
    for (let i = 0; i < data.length; i++) {
        var dataObj = data[i];
        if (dataObj.id == mSrcArray[0]) {
            dataObj.id = mDstArray[0];
            dataObj.count = mCurStar;
            dataObj.value = JSON.stringify(value);
            return true;
        }
    }
}

//发星星数据到UI层(给客户端)
function sendStarToUI(receivers, senderIDStr, starType, star, acTime, senStarType) {
    _log("sendStarToUI senderIDStr=" + senderIDStr + ", t=" + t + ", star=" + star + ", acTime=" + acTime + ", receivers.len=" + receivers.length);
    if (receivers == null) {
        _log("sendStarToUI receivers == null")
        return;
    }
    var h5ToCData = {
        "receivers": receivers,
        "senderID": senderIDStr,
        "acTime": acTime,
        "star": star,
        "starType": starType,
        "sendStarType": sendStarType
    }
    aiH5ToC("sendStar", h5ToCData);
}

//老师进入教室时，向客户端抛一条消息
function handleMemberChange(bean) {
    var item = JSON.parse(bean.jsonStr);
    if (item.state == "enter") {
        if (item.type == "tea") {
            var h5ToCData = {
                actime: bean.actime
            }
            aiH5ToC("teaEnter", h5ToCData)
        }
    }
}

function handleInit(bean) {
    var jsonTree = JSON.parse(bean.jsonStr);
    mSrcArray[0] = jsonTree.userId;
    mSrcArray[1] = jsonTree.courseId;
    _log("录制原用户信息 userId=" + mSrcArray[0] + "， courseId=" + mSrcArray[1]);
}

function makeWbData(bean) {
    if (bean == null) return;
    handleToH5(bean.acTime, bean.head, bean.jsonStr);
}

//AIH5给客户端的数据，并调用android方法
function aiH5ToC(type, jsonStr) {
    _log("aiH5ToC >>> "+typeof(jsonStr));
    var h5ToCJson = JSON.stringify(jsonStr);
    _log("aiH5ToC >>> h5ToCJson="+h5ToCJson);
    if (window.android != undefined) {
        window.android.AIAcJs_get(type, jsonStr);
    }
}

//客户端调AIH5的数据
//type = 方法名类型
//data = json
window.cToAIH5 = function (type, data) {
    var item = null;
    if(typeof(data) == "String"){
        item = JSON.parse(data);
    }else{
        item = data;
    }
    _log("type="+type+", data="+JSON.stringify(data));
    if (type == "AIInitData") {
        start(item.uid, item.courseID);
    } else if (type == "getItemData") {
        handleMessage(item.json, item.ms);
    } else {
        fromH5(type, data);
    }
}

//客户端要传给教材控制器的数据
//dataType 0=从H5过来的数据，1=解析脚本的数据
function toH5(type, data) {

}

//教材控制器传给客户端的数据
function fromH5(type, strData) {
    log.log("fromH5 >>> type=" + type + ", data=" + strData);
    if (type == "notifyData") {
//            notifyData(data, null);
    } else if (type == "gSetData") {
//            gsetData(data,null);
    } else if (type == "pageData") {
//            pageData(data,null);
    } else if (type == "scrollData") {
//            scrollData(data,null);
    } else if (type == "wbAddData") {
//            wbOrClAddData(data, null, 0);
        _log("fromH5 wbAddData");
        var item = JSON.parse(strData);
        var operate = item.operate;
        var page = item.page;
        if (mUsingPaintbrush && "1" == operate && page == mCurPage) {
            makeWbBackData(item);
        }
    } else if (type == "wbDelData") {
//            wbOrClDelData(data, createAc(CMD_H5_Board_Del));
    } else if (type == "wbEditData") {
//            wbOrClEditData(data, createAc(CMD_H5_Board_Edit));
    } else if (type == "wbClearData") {
//            wbOrClClearData(data, createAc(CMD_H5_Board_Clear));
    } else if (type == "wbReqData") {
//            wbOrClReqData(data, createAc(CMD_H5_Board_Get));
    } else if (type == "clAddData") {
//            wbOrClAddData(data, null, 1);
        log.log("fromH5 clAddData >>> " + strData);
        var json = JSON.parse(strData);
        var operate = json.operate;
        var typeValue = json.type;
        var page = json.page;
        if ("1" == operate && "sync" == typeValue && page == mCurPage) {
            makeBackData(json);
        } else if (isEmpty(strData) && (dataStr.indexOf("resultSyncStu") != -1)) {
            //教材直接返回的答题信息
            fromH5AnswerData();
        }
    } else if (type == "clDelData") {
//            wbOrClDelData(data, createAc(CMD_H5_Data_Del));
    } else if (type == "clEd itData") {
//            wbOrClEditData(data, createAc(CMD_H5_Data_Edit));
    } else if (type == "clClearData") {
//            wbOrClClearData(data, createAc(CMD_H5_Data_Clear));
    } else if (type == "clReqData") {
//            wbOrClReqData(data,createAc(CMD_H5_Data_Get));
    } else if (type == "starData") {
        fromH5StarData(data);
    } else if (type == "showerrorpage") {
//            ac.sendMsg(H5Doc.H5Doc_Error, 0, 0, null);
    } else if (type == "recording") {
        var recStr = data.getString("word");
        var action = data.getInt(0, "action");
//            ac.sendMsg(H5Doc.H5Doc_Record, action, mCurrentPage, recStr);
    } else if (type == "transferData") {
//            transferData(data, null);
    } else if (type == "memberNum") {
//            memberNum(data, null);
    } else {
    }
}

function makeWbBackData(){

}

//教材直接返回的答题信息
function fromH5AnswerData() {

}

//直接从教材获得星星
function fromH5StarData(starData) {
    var item = JSON.parse(strData);
    var star = item.value.starAdd;
    if (star <= 0) return;
    var startype = item.value.starType;
    var senderID = item.value.senderID;
    var receivers = [];
    receivers[0] = mDstArray[0];
    sendStarToUI(receivers, senderID, startype, star, -1, 1);

}

//日志
function _log(log) {
    console.log(log)
}

//判断字符串是否为空
function isEmpty(property) {
    return (property === null || property === "" || typeof property === "undefined");
}









