// configuration
var apiToken = "" // Telegram Bot Token
var appUrl   = "" // Server URL
var apiUrl   = "https://api.telegram.org/bot" + apiToken;
var command  = {
  "/start": start,
  "/random_recommended": random_recommended,
  "/all_recommended": all_recommended,
  "/random_discount" : random_discount, 
  "/all_discount" : all_discount,
  "/add_tajrobe": add_tajrobe,
  "/find_day": find_day
}
var days = {
  0: "شنبه", 
  1: "یکشنبه",
  2: "دوشنبه",
  3: "سه‌شنبه", 
  4: "چهارشنبه", 
  5: "پنج‌شنبه", 
  6: "جمعه"
}
var space_after_day = {
  "شنبه": "       ",
  "یکشنبه": "    ",
  "دوشنبه": "    ",
  "سه‌شنبه": "   ",
  "چهارشنبه": " ",
  "پنج‌شنبه": "‌   ",
  "جمعه": "      "
}
var name_month = "مهر"
var month_number = 7
var year_number = 1403
var num_results = 5
var num_earliest_game_results = 40
var discard_requests = false
var default_opts = {"muteHttpExceptions": true}
var cant_find_command = "دستور موردنظر یافت نشد! از /start برای راهنمایی استفاده کنید."
var start_text = "خیلی خوشحالیم که از اسکیپ بات استفاده می‌کنید! این بات جهت تسریع روند پیدا کردن اسکیپ روم ساخته شده است.\n" + 
"برای استفاده از بات می‌توانید دستورات زیر را امتحان کنید." + "\n"  +
"/random_recommended برای اسم یک اتاق فرار رندوم از لیست پیشنهادی ما"+ "\n" +
"/all_recommended برای کل لیست پیشنهادی"+ "\n" +
"/find_day برای نزدیک‌‌ترین سانس اسکیپ‌روم‌های لیست پیشنهادی"+ "\n" +
"همینطور بعد از find_day می‌توانید اسم یک اسکیپ روم را ارسال کنید تا لیست نزدیک‌ترین سانس‌های آن به شما داده شود و یا اینکه بعد از آن اسم یکی از روزهای هفته را بنویسید تا سانس‌های لیست پیشنهادی فقط در همان روز به شما داده شود."+ "\n" +
"دقت کنید که اسم روز هفته باید حتما یکی از حالت‌های زیر باشد"+ "\n" +
"شنبه - یکشنبه - دوشنبه - سه‌شنبه - چهارشنبه - پنج‌شنبه - جمعه (نیم‌فاصله باید رعایت شود)"

// set webhook
function setWebhook(){
  var url = apiUrl + "/setwebhook?url="+appUrl;
  var res = UrlFetchApp.fetch(url).getContentText();
  Logger.log(res);
}

function find_day(request_data) {
  var request_key = request_data.message.from.id + "+" + request_data.message.message_id
  var request_keys = getSheetByName('find_requests').getDataRange().getValues()
  for (var key_idx in request_keys) {
    if (request_key == request_keys[key_idx][0]) {
      return
    }
  }
  getSheetByName('find_requests').appendRow([request_key])

  var sent = false
  var data = getSheetByName('recommended').getDataRange().getValues()

  var filters = [function(value) {
    return value[7].startsWith("تهران")
  }]

  var commands_find_day = request_data.message.text.slice("/find_day".length, request_data.message.text.length).trim()
  if (commands_find_day.length > 0) {
    var exact_name_seach = exact_seach(commands_find_day)
    if (exact_name_seach[0] >= 0) {
      data = [[], [commands_find_day]]
      filters[0] = function(value) {
        return true
      }
      // This bot does not support جاسوس
      if (commands_find_day == "جاسوس" || commands_find_day == "نفوذ") {
        var payload = {"chat_id": request_data.message.from.id, "text": "این بات با سانس‌های این اسکیپ روم هیچ‌کاری ندارد!", "parse_mode": "Markdown"}
        var opts = {'method' : 'post', 'contentType': 'application/json', "muteHttpExceptions": true, "payload": JSON.stringify(payload)}
        call_telegram_api("/sendMessage", opts)
        return
      }
    } 
    for (var day_number in days) {
      if (days[day_number] == commands_find_day) {
        filters[filters.length] = function(value) {
          return value[3] == commands_find_day
        }
        break
      }
    }
  }

  var arr_days = []
  var message_id = null
  for (var i = 0; i < data.length; i++) {
    if (i == 0) continue
    var name = data[i][0]
    var returned_result = get_dates_for_game(num_earliest_game_results, name)

    for (var filter_num in filters) {
      returned_result = returned_result.filter(filters[filter_num])
    }

    arr_days = arr_days.concat(returned_result)
    arr_days = arr_days.sort().slice(0, num_earliest_game_results)
    getSheetByName('requests').appendRow([name])
    if (sent) {
      var payload = {"chat_id": request_data.message.from.id, "message_id":message_id, "text": array_game_sessions_to_string(arr_days, i == (data.length - 1)), "parse_mode": "Markdown"}
      var opts = {'method' : 'post', 'contentType': 'application/json', "muteHttpExceptions": true, "payload": JSON.stringify(payload)}
      log_sheet(["edit " + message_id, call_telegram_api("/editMessageText", opts), JSON.stringify(payload)])
    } else {
      var payload = {"chat_id": request_data.message.from.id, "text": array_game_sessions_to_string(arr_days, i == (data.length - 1)), "parse_mode": "Markdown"}
      var opts = {'method' : 'post', 'contentType': 'application/json', "muteHttpExceptions": true, "payload": JSON.stringify(payload)}
      var server_ans = call_telegram_api("/sendMessage", opts)
      log_sheet([JSON.stringify(request_data), server_ans, JSON.stringify(payload)])
      message_id = JSON.parse(server_ans).result.message_id
      sent = true
    }
  }
}

function array_game_sessions_to_string(arr, is_completed) {
  if (arr.length == 0) {
    if (is_completed) return 'هیچ آیتمی در لیست وجود ندارد!'
    return 'هنوز هیچ آیتمی در لیست وجود ندارد!\nلیست در حال تکمیل شدن است.'
  }
  var ret = ''
  for (var i = 0; i < arr.length; i++) {
    ret += arr[i][2] + ' ' + name_month + ' سانس ' + arr[i][1] + ' ' + arr[i][3] + space_after_day[arr[i][3]] + '[' + arr[i][5] +'](' + arr[i][6] + ')' + '\n'
  }

  if (is_completed) return ret
  return ret + '\n\nاین لیست در حال تکمیل شدن می‌باشد...'
}

function get_dates_for_game(number, name){
  var game_data = t4f_exact_search(name)
  if (game_data[0] < 0) return escape_room_dot_ir_times(name)
  var website = UrlFetchApp.fetch("https://www.t4f.ir/fun/" + game_data[0] + "/checkout?by=web", {"muteHttpExceptions": true})
  var cookie = website.getHeaders()['Set-Cookie']
  var html_context = website.getContentText()
  var $ = Cheerio.load(html_context)
  var all_days = $(".cell")
  var return_arr = []

  for (var i = 0; i < all_days.length; i++) {
    var selected = all_days.eq(i)
    if (selected.hasClass("blank") || selected.hasClass("day-header") || selected.hasClass("disabled")) continue
    var id = selected.attr("id")
    var day_of_month = selected.text().trim()
    var day_of_week = days[i % 7]

    var url = "https://www.t4f.ir/fun/" + game_data[0] + "/checkout/day_data?fun_id=" + game_data[0] + "&date_id=" + id
    var headers = {"Referer": "https://www.t4f.ir/fun/" + game_data[0] + "/checkout?by=web", "Cookie": cookie}
    var html_options = JSON.parse(UrlFetchApp.fetch(url, {'method' : 'get', "muteHttpExceptions": true, "headers": headers}))['html']

    var time_options = Cheerio.load(html_options)("#time").children()
    for (var j = 0; j < time_options.length; j++) {
      var temp = time_options.eq(j)
      if (temp.attr("data-status") == "1") {
        var data_start_at = temp.attr("data-start-at")
        if (data_start_at.length == 4) data_start_at = "0" + data_start_at
        return_arr[return_arr.length] = [id, data_start_at, day_of_month, day_of_week, game_data[0], game_data[1], "https://www.t4f.ir/fun/" + game_data[0] + "/checkout?by=web", game_data[4]]
        if (return_arr.length == number) return return_arr
      }
    }
  }
  return return_arr
}

function update_recommended(){
  var names = getSheetByName('recommended2').getDataRange().getValues()
  var new_sheet = getSheetByName('recommended3')

  new_sheet.appendRow(['Name', 'Location', 'Level', 'Rating', 'Rating_count', 'is available'])
  for (var idx in names) {
    if (idx == 0) continue
    var result = exact_seach(names[idx][0])
    if (result[0] < 0) {
      new_sheet.appendRow([names[idx][0], '', '', '', '', true])
      Logger.log(names[idx][0])
    } else {
      new_sheet.appendRow([result[1], result[4], result[9], result[5], result[6], result[8] == "selling"])
    }
  }
  getSheetByName('recommended3').getRange("F2:F" + names.length).insertCheckboxes()
}

function add_tajrobe(requestData) {
  var text = requestData.message.text
  var id = requestData.message.from.id
  if ((id != "") && (id != "")) { // Telegram admin IDs
    log_sheet([requestData.message.text, call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + requestData.message.from.id + "&text=" + encodeURIComponent('شما دسترسی اجرای این دستور را ندارید.'), default_opts), 'شما دسترسی اجرای این دستور را ندارید.'])
    return
  }
  if (text.length == "/add_tajrobe".length) {
    log_sheet([requestData.message.text, call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + requestData.message.from.id + "&text=" + encodeURIComponent("بعد از این دستور حتما باید اسم اتاق فرار را وارد کنید!"), default_opts), "بعد از این دستور حتما باید اسم اتاق فرار را وارد کنید!"])
    return
  }
  var sheet = getSheetByName('history')
  sheet.appendRow([text.slice("/add_tajrobe".length + 1, text.length)])
  log_sheet([requestData.message.text, call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + requestData.message.from.id + "&text=" + encodeURIComponent("تجربه جدید با موفقیت اضافه شد!"), default_opts), "تجربه جدید با موفقیت اضافه شد!"])
}

function start(requestData){
  register_user(requestData)
  var opts = {'method' : 'post', 'contentType': 'application/json', "muteHttpExceptions": true, "payload": JSON.stringify({"chat_id": requestData.message.from.id, "text": start_text})}
  log_sheet([requestData.message.text, call_telegram_api("/sendmessage", opts), start_text])
}

function register_user(requestData) {
  var data = getSheetByName('all_users').getDataRange().getValues()
  for (var idx in data){
    if (data[idx][0] == requestData.message.from.id) return
  }
  getSheetByName('all_users').appendRow([requestData.message.from.id, requestData.message.from.first_name, requestData.message.from.username])
}

function random_recommended(requestData) {
  var sheet = getSheetByName('recommended')
  var data = sheet.getDataRange().getValues()
  var ret = 'یافت نشد!'
  for (var i = 0; i < 100; i++) {
    var random_idx = Math.floor(Math.random() * (data.length - 1)) + 1;
    var row = data[random_idx]
    var res = exact_seach(data[random_idx][0])
    if (res[0][0] < 0 && row[5]) {
      var ret = 'اسم: ' + row[0] + '\nمکان: '
      if (row[1] == '') {
        ret += 'نامشخص\nامتیاز: '
      } else {
        ret += row[1] + '\hامتیاز: '
      }
      if (row[2] == '') {
        ret += 'نامشخص'
      } else {
        ret += row[2]
      }
      break
    }
    if (res[8] != "selling") {
      continue
    } 
    var ret = 'اسم: ' + res[1] + '\nمکان: '
    if (res[4] == '') {
      ret += 'نامشخص\nامتیاز: '
    } else {
      ret += res[4] + '\nامتیاز: '
    }
    ret += String(res[5]).slice(0, 4)
    break
  }
  log_sheet([requestData.message.text, call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + requestData.message.from.id + "&text=" + encodeURIComponent(ret), default_opts), ret])
}

function all_recommended(requestData) {
  var ret = 'اسامی: \n'
  var data = getSheetByName('recommended').getDataRange().getValues()
  for(var idx in data) {
    if (idx == 0) continue
    ret += data[idx][0] + '\n'
  }
  log_sheet([requestData.message.text, call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + requestData.message.from.id + "&text=" + encodeURIComponent(ret), default_opts), ret])
}

function random_discount(requestData) {
  var sheet = getSheetByName('discounts')
  var data = sheet.getDataRange().getValues()
  var ret = 'یافت نشد!'
  for (var i = 0; i < 100; i++) {
    var random_idx = Math.floor(Math.random() * data.length) + 1;
    var row = data[random_idx]
    var ret = 'اسم: ' + row[0] + '\nمقدار تخفیف: '
    if (row[1] == '') {
      ret += 'نامشخص\n'
    } else {
      ret += row[1] + '\n'
    }

    if (row[2]) {
      break
    }
  }
  log_sheet([requestData.message.text, call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + requestData.message.from.id + "&text=" + encodeURIComponent(ret), default_opts), ret])
}

function all_discount(requestData) {
  let ret = 'اسامی: \n'
  let data = getSheetByName('discounts').getDataRange().getValues()
  for(let idx in data) {
    if (idx == 0) continue
    ret += data[idx][0] + '\n'
  }
  // return ret
  log_sheet([requestData.message.text, call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + requestData.message.from.id + "&text=" + encodeURIComponent(ret), default_opts), ret])
}

function getSheetByName(name) {
  let arr = SpreadsheetApp.getActiveSpreadsheet().getSheets()
  for (let idx in arr){
    if (arr[idx].getSheetName() == name) {
      return arr[idx]
    }
  }
  return arr[0]
}


// handle webhook
function doPost(e){
  if (discard_requests) {
    return
  }
  var requestData = JSON.parse(e.postData.contents);
  try {
    handle_request(requestData)
  } catch(e) {
    getSheetByName('exceptions').appendRow([e.stack, e.message])
    call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + requestData.message.from.id + "&text=" + encodeURIComponent("مشکلی رخ داد لطفا یک بار دیگر امتحان کنید!"))
  }
}

function handle_request(data){
  if (typeof data.inline_query != 'undefined') {
    handle_inline(data)
    return
  }

  for (var c in command) {
    if (c == data.message.text.split(" ")[0]) {
      command[c](data)
      return
    }
  }

  if (exact_seach(data.message.text)[0] >= 0) {
    data.message.text = "/find_day " + data.message.text
    command["/find_day"](data)
    return
  }

  log_sheet([data.message.text, call_telegram_api("/sendmessage?parse_mode=HTML&chat_id=" + data.message.from.id + "&text=" + encodeURIComponent('دستور مورد نظر یافت نشد!'), default_opts), 'دستور مورد نظر یافت نشد!'])
}

function handle_inline(data) {
  var payload = {"inline_query_id": data.inline_query.id, "results": make_inline_results(data)}
  var opts = {'method' : 'post', 'contentType': 'application/json', "muteHttpExceptions": true, "payload": JSON.stringify(payload)}
  log_sheet([data.inline_query.query, call_telegram_api("/answerInlineQuery", opts)])
}

function make_inline_results(data) {
  var ret = []
  if (data.inline_query.query.length <= 1) return make_template_more_words_inline(data)
  var results = t4f_search_results(num_results, data.inline_query.query)
  for (var i = 0; i < num_results; i++){
    if (results[i][0] < 0) break
    var message_text = "بازی: " + results[i][1] + "\nمحله: " + results[i][4] + "\nژانر: " + results[i][7] + "\nوضعیت برگزاری: " + selling_status(results[i]) + "\n\nامتیاز " + String(results[i][5]).slice(0, 4) + " از " + results[i][6] + " رای\n\n[لینک بازی](" + results[i][2] + ")"
    ret[i] = {"type": "article", "id": "00" + (i+1), "title": results[i][1], "input_message_content": {"message_text": message_text, "parse_mode": "Markdown"}, "url": results[i][2], "thumbnail_url": results[i][3]}
  }
  if (ret.length == 0) return make_template_no_results_inline(data)
  return ret
}

function selling_status(result) {
  if (result[8] == "selling") return "در حال برگزاری"
  return "اکسپایر شده"
}

function make_template_no_results_inline(data) {
  return [{"type": "article", "id":"001", "title": "هیچ نتیجه‌ای پیدا نشد", "input_message_content": {"message_text": "هیچ نتیجه‌ای برای سرچ " + data.inline_query.query + " پیدا نشد!"}}]
}

function make_template_more_words_inline(data) {
  return [{"type": "article", "id":"001", "title": "لطفا کاراکتر های بیشتری تایپ کنید", "input_message_content": {"message_text": "برای پیدا کردن نتایج بهتری اسم طولانی‌تری انتخاب کنید!"}}]
}

function exact_seach(query) {
  var res = t4f_exact_search(query)
  if (res[0] >= 0) return res

  res = escape_room_dot_ir_result(query)
  if (res[0] >= 0) return res
  return [-1]

}

function t4f_exact_search(query) {
  if (query == "M-19") query = "M 19"
  var top_results = t4f_search_results(10, query)
  for (var idx in top_results) {
    if (top_results[idx][0] < 0) return [-1]
    if (top_results[idx][1] == query) return top_results[idx]
  }
  return [-1]
}

function t4f_search_results(number, query){
  var url = "https://www.t4f.ir/api/v1/search?filter=" + encodeURIComponent(JSON.stringify({"q": query}))
  var data = JSON.parse(UrlFetchApp.fetch(url, {"muteHttpExceptions": true}).getContentText())


  var ret = []
  for (var i = 0; i < number; i++) ret[i] = [-1]
  if (query == "نفوذ") {
    ret[0] = return_poopedia_result(query)
    return ret
  }

  var items = data.data.items
  for (var idx in items) {
    if (idx >= number) break
    ret[idx][0] = items[idx].id
    ret[idx][1] = items[idx].name
    ret[idx][2] = items[idx].url
    ret[idx][3] = items[idx].image
    ret[idx][4] = items[idx].location
    ret[idx][5] = items[idx].rating.score / 10
    ret[idx][6] = items[idx].rating.count
    ret[idx][7] = items[idx].genres
    ret[idx][8] = items[idx].status
    ret[idx][9] = items[idx].level
    if (items[idx].name === 'جاسوس') {
      ret[idx][5] = 0
      ret[idx][6] = 827272828
      ret[idx][7] += '\n (به هیچ وجه توصیه نمیشه، خواهشا نرید!)'
      ret[idx][2] = "https://poopedia.org/"
    }
    if (items[idx].name == "M 19") {
      ret[idx][7] += "\n (به شدت توصیه میشه!)"
    }
  }
  return ret
  
}

function return_poopedia_result(query) {
  return [0, query, "https://poopedia.org/", "", "تهران", 0, "827272828", "گوه\n(به هیچ وجه توصیه نمیشه، خواهشا نرید!)", "selling", "platinum"]
}

function escape_room_dot_ir_result(query) {
  var names = getSheetByName('escaperoom.ir').getDataRange().getValues()
  for (var idx in names) {
    if (names[idx][0] == query) {
      var id = names[idx][1]
      var url = names[idx][2]
      var image_url = names[idx][3]

      return [id, query, url, image_url, "تهران", "-", "-", "", "selling", ""]
    }
  }
  return [-1]
}

function escape_room_dot_ir_times(query) {
  var search_result = escape_room_dot_ir_result(query)
  if (search_result[0] < 0) return []
  var headers = {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest", "Origin": "https://escaperoom.ir", "Referer": search_result[2]}
  var body = "branch_game_id=" + search_result[0] + "&month=" + month_number
  var opts = {"method" : "post", "muteHttpExceptions": true, "headers": headers, "payload": body}
  var html_response = UrlFetchApp.fetch("https://escaperoom.ir/escaperoom/escaperoom/calendar/load_calendar", opts).getContentText()
  var $ = Cheerio.load(html_response)
  var all_days = $("td")
  var ret = []

  var day_idx = 0
  for (var idx in all_days) {
    if (idx < 8) continue
    var element = all_days.eq(idx)
    if (element.children().length == 0) {
      day_idx = (day_idx + 1) % 7
      continue
    }
    element = element.children().eq(0)
    if (!element.hasClass("day")) {
      day_idx = (day_idx + 1) % 7
      continue
    }
    if (element.hasClass("disable") || element.hasClass("soldout")) {
      day_idx = (day_idx + 1) % 7
      continue
    }
    var day_number_str = element.attr("id").split("-")[element.attr("id").split("-").length - 1]
    body = "branch_game_id=" + search_result[0] + "&year=" + year_number + "&month=" + month_number + "&day=" + day_number_str
    opts["payload"] = body
    var server_response = decodeURIComponent(JSON.parse(UrlFetchApp.fetch("https://escaperoom.ir/escaperoom/escaperoom/calendar/load_time", opts))["btn"])
    var server_response_parse = Cheerio.load(server_response)
    var clocks = server_response_parse(".clock")
    var statuses = server_response_parse(".status")

    for (var clock_idx in clocks) {
      if (clock_idx >= statuses.length) break
      if (statuses.eq(clock_idx).text() == "FREE") {
        ret[ret.length] = [day_number_str, clocks.eq(clock_idx).text(), day_number_str, days[day_idx], search_result[0], search_result[1], search_result[2], "تهران"]
      }
    }

    day_idx = (day_idx + 1) % 7
  }
  ret = ret.sort()
  return ret
}

// function change_trigger(e) {
//   getSheetByName('triggered').appendRow([e.authMode, e.changeType, e.source, e.triggerUid, e.user])
// }

function log_sheet(arr) {
  getSheetByName('requests').appendRow(arr)
}

function call_telegram_api(url, opts) {
  return UrlFetchApp.fetch(apiUrl + url, opts).getContentText()
}


function add_change_trigger() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('change_trigger')
      .forSpreadsheet(ss)
      .onChange()
      .create();
}

function see_triggers() {
  const allTriggers = ScriptApp.getProjectTriggers();
  for (let index = 0; index < allTriggers.length; index++) {
    // If the current trigger is the correct one, delete it.
    Logger.log(allTriggers[index].getUniqueId())
  }
}

function delete_all_triggers() {
  const allTriggers = ScriptApp.getProjectTriggers();
  for (let index = 0; index < allTriggers.length; index++) {
    // If the current trigger is the correct one, delete it.
    ScriptApp.deleteTrigger(allTriggers[index]);
  }
}

function doGet(e){
  return ContentService.createTextOutput("Method GET not allowed");
}
