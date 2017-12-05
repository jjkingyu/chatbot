/**
 * Created by Qpp on 2017/12/3.
 */
(function(){
  // submit chat
    $("#chat_submit").click(function () {
        var input_content = $(".chat_input").val();
        if(input_content == ''){
            // alert("内容为空");
            return;
        }else{
            var $top = $(".top")
            var $div = $(".top_user");
            var $content="<div class='user_message'><img class='user_icon' src='img/1208228.png'><div class='input_word'><span>"+input_content+"</span><em></em></div></div>";
            $top.append($content);
            var input_content = $(".chat_input").val('');
            sendAjax(input_content);
            var i = $top[0].scrollHeight;
            $top.scrollTop(i);

        }
    });
    $(document).keydown(function(event){
      if(event.keyCode==13){
      $("#chat_submit").click();
      }
    });
    function sendAjax(input_content) {
        $.ajax({
            url: "http://rap.taobao.org/mockjsdata/29973/chat",
            data:input_content,
            async:false,
            type:"POST",

            success: function (data) {
                show_bot_response(data);
            },
            error:function (data) {
                alert(data);
            }
        })
   }
   function show_bot_response(data) {
       var $top = $(".top")
       // alert(data.bot_content);
       var $content="<div class='user_message'><img class='bot_icon' src='img/robot.png'><div class='bot_word'><span>"+data.bot_content+"</span><em></em></div></div>";
       $top.append($content);
    }
   $(".voice_icon").addClass("icon_hover");
    $(".voice_icon").click(function(){
          $(".chat").css("display","none");
          $(".voice").css("display","block");
          $(".voice_icon").css("color","white");
          $(".chat_icon").css("color","black");
          $(".chat_icon").addClass("icon_hover");
          $(".voice_icon").removeClass("icon_hover");

    });

    $(".chat_icon").click(function(){
        $(".chat").css("display","block");
        $(".voice").css("display","none");
        $(".voice_icon").css("color","black");
        $(".voice_icon").addClass("icon_hover");
        $(".chat_icon").removeClass("icon_hover");
        $(".chat_icon").css("color","white");

      });

      function set_div_height(){

         var height = document.documentElement.clientHeight;
         var top_height = height*0.62;
         var bottom_height = height*0.17;
         $(".top").css("height",top_height);
         $(".bottom").css("height",bottom_height);
        //  alert(height);
      }
      set_div_height();
      window.onresize = function(){
          set_div_height();
      }


      $(".start").click(function(){
        $(".start").css("color","#b1b1b1");
        $(".stop").css("color","#3975aa");
        $(".search").removeClass("rotation");
      });
      $(".stop").click(function(){
        $(".stop").css("color","#b1b1b1");
        $(".start").css("color","#3975aa");
        $(".search").addClass("rotation");
      });
      // search
      $("#search").click(function(){
        var voicedata = "Pluto's History";
        search_result_ajax();
        $(".search").removeClass("rotation");
      });

      function show_search_result(voice_word,search_result){
        var $top = $(".top");
        var $search_result="<div class='search_warp'>"+
                            "<img class='bot_icon' src='img/robot.png'>"+
                            "<div class='search_result'>"+
                            "<span class='record_voice'><b>Your voice: </b> "+ voice_word+"</span><em></em>"+
                            "<span class='result'>"+search_result+" </span>"+
                            "</div></div>";
        $top.append($search_result);
        var i = $top[0].scrollHeight;
        $top.scrollTop(i)
      };

      function search_result_ajax(){
        $.ajax({
          url: "http://rap.taobao.org/mockjsdata/29973/search",
          data:'',
          async:false,
          type:"POST",
          success: function (data) {
              var voice_word = data.voice_word;
              var search_result = data.search_result;
              if(voice_word==''){
                return;
              }else {
                  show_search_result(voice_word,search_result);
              }

          },
          error:function (data) {
              alert(data);
          }
        });
      }



})();
