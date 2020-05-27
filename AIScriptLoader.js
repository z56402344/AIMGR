var TYPE_CLINT = 0;
var TYPE_TOH5 = 1;
var TYPE_FROMH5 = 2;
var TYPE_QUESTION = 3;
var TYPE_TOH5_FIX = 4;

var mLocalStartTime = 0;

function AIScriptItem(acTime,type,head,jsonStr) {
    this.acTime = acTime;
    this.type = type;
    this.head = head;
    this.jsonStr = jsonStr;
    this.next = this;
}

var mHeadItem;
var mLastItem;

//设置时间
function setLocalStartTime(time) {
    mLocalStartTime = time;
}

//加载脚本文件
function load(filePath) {
    // 打开文件
    let fso, ForAppending;
    try {
        ForAppending = 1;
        fso = new ActiveXObject("Scripting.FileSystemObject");
    } catch (e) {
        alert("当前浏览器不支持");
        return;
    }
    let file = fso.OpenTextFile(filePath, ForAppending, true);

}


//下一个脚本的执行时间
function nextTimer() {
    if (mHeadItem == null)return null;
    var ms = new Date().getTime() - mLocalStartTime;
    if (mHeadItem.acTime <= ms)return 0;
    return mHeadItem.acTime - ms;
}

//读取下一条数据
function pop() {
    if (mHeadItem == null)return null;
    var ms = new Date().getTime() - mLocalStartTime;
    var head = mHeadItem;
    var last = null;
    while (head != null && (head.acTime <= ms || head.type != TYPE_TOH5)){
        last = head;
        head = head.next;
    }
    if (last == null)return null;
    head = mHeadItem;
    mHeadItem = last.next;
    last.next = null;
    return head;
}

//获取当前页面答案数据的方法
function getQuestion(curPage) {
    return queryItem(TYPE_QUESTION,curPage);
}

//查询指定类型的数据
function queryItem(type,head) {
    var item = mHeadItem;
    while (item != nul){
        if (item.type == type){
            if (head == null)return item;
            if (item.head == head){
                return item
            }
        }
        item = item.next;
    }
    return null;
}

//获取最后一条数据
function queryEndItem() {
    return mLastItem;
}

//关闭
function close() {
    mHeadItem = null;
}




