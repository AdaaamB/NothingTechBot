import praw, os, re, time
import pandas as pd
from datetime import date

#init
try:
  reddit = praw.Reddit(
    client_id=os.environ["client_id"],
    client_secret=os.environ["client_secret"],
    username="adbobot",
    password=os.environ["reddit_password"],
    user_agent="PyEng Bot 0.1",
  )
  
  retry_delay = 30  
  subreddit = reddit.subreddit("adbotest")
  moderators = subreddit.moderator()
  wiki_page_name = "index"
  wiki_page = subreddit.wiki[wiki_page_name]
  wiki_contents = wiki_page.content_md
  print("Init complete")
except Exception as e:
  print(f"Encountered an exception during startup: {e}")

# check if they have a flair; if it's a star flair or a custom one
def handle_current_flair(user, new_points):
    user_flair_text = None
    # check if they have an existing flair and find the flair text
    for flair in subreddit.flair(user):
        print("Found user's existing flair")
        if flair["flair_text"] is not None:
            user_flair_text = flair["flair_text"]
            print(f"Existing flair text is {user_flair_text}")
            break
    # if their flair text is nothing, set thanks to 1
    if not user_flair_text:
        print("No flair set, setting thanks to 1")
        user_flair_text = f"★ {new_points}"
    # if a star already exists in the flair, increment the thanks count
    elif str("★") in user_flair_text:
        cur_points = int(user_flair_text.split(" ")[-1])
        print(f"Thanks flair set, incrementing {str(cur_points)} to {str(new_points)}")
        user_flair_text = user_flair_text.replace(str(cur_points), str(new_points))
    else:
        print("Custom flair detected")
        user_flair_text = "custom"
        # # Check if user's custom flair already has a star
        # if any(char == "★" for char in user_flair_text):
        #     # Extract the current points value
        #     points = int(user_flair_text.split()[-1])
        #     print(f"Custom flair set, incrementing {str(points)}")
        #     # Append the new points value to the user's existing flair
        #     user_flair_text = user_flair_text.replace(str(points), str(points + 1))
        # else:
        #     # Append the star and points to the user's existing flair
        #     print("Custom flair set, appending thanks to 1")
        #     user_flair_text += " | ★ 1"
    return user_flair_text

# set flair if not custom
def set_flair(user_flair_text):
    if user_flair_text == "custom":
        response = f"Thank you for registering your thanks, however this user has a custom flair so their level is not displayed."
        comment.reply(response)
        print("Custom flair, thanks not added")
    else:
        subreddit.flair.set(user, text=user_flair_text, flair_template_id=None)
        points = user_flair_text.split()[-1]
        point_text = "point" if points == "1" else "points"
        response = (
            f"Thanks for u/{user} registered. They now have {str(points)} {point_text}!"
        )
        comment.reply(response)
        print("Thanks added")

# extract the numeric value from the Level column
def get_level_num(level):
    if isinstance(level, str):
        level_num = level.split(" ")[-1]
        if level_num.isdigit():
            return int(level_num)
    return None

# get the wiki leaderboard
def get_wiki_leaderboard():
    # split markdown table string into rows
    rows = wiki_contents.strip().split("\n")[4:]
    # split each row into cells
    cells = [[cell.strip() for cell in row.split("|")[1:-1]] for row in rows]
    # create a pandas DataFrame from cells
    df = pd.DataFrame(cells, columns=["Username", "Level", "Last Star Date"])
    # convert 'Last Star Date' column to datetime type
    df["Last Star Date"] = pd.to_datetime(df["Last Star Date"]).dt.date

    return df

# set the wiki leaderboard, update or add user, level and date
def set_wiki_leaderboard(df, user_exists_in_leaderboard, user, points):
    user = f"u/{user}"
    today = date.today()
    if user_exists_in_leaderboard:
        # update the level and date cells on the row matching the username
        df.loc[df["Username"] == user, "Level"] = f"★ {points}"
        df.loc[df["Username"] == user, "Last Star Date"] = today.strftime("%Y-%m-%d")
    else:
        print("User not located in table")
        new_row = {
            "Username": user,
            "Level": f"★ {points}",
            "Last Star Date": today.strftime("%Y-%m-%d"),
        }
        df.loc[len(df)] = new_row

    # apply the function to create a new column with the numeric value of the Level column
    df["Level Num"] = df["Level"].apply(get_level_num)
    # sort the DataFrame by the Level Num column
    df = df.sort_values(by=["Level Num", "Last Star Date"], ascending=[False, True])
    # remove the Level Num column
    df = df.drop("Level Num", axis=1)
    # convert DataFrame back to markdown
    markdown_table = (
        f"This page is updated by a robot. Do not edit. *Last update*: {today.strftime('%Y-%m-%d')}\n\n" + df.to_markdown(index=False)
    )
    # overwrite subreddit wiki page with new markdown
    subreddit.wiki[wiki_page_name].edit(content=markdown_table)

# perform actions to thank - get wiki points, handle flair, set flair, set leaderboard
def thank_user(user):
  df = get_wiki_leaderboard()
  user_exists_in_leaderboard = df[df["Username"] == f"u/{user}"]
  if not user_exists_in_leaderboard.empty:
      print(f"User: {user} exists in leaderboard, so incrementing existing points")
      level = user_exists_in_leaderboard["Level"].iloc[0]
      last_star_date = user_exists_in_leaderboard["Last Star Date"].iloc[0]
      points = int(level.split(" ")[-1]) + 1
  else:
      print(f"User: {user} doesn't exist in leaderboard, so points = 1")
      points = 1
  user_flair_text = handle_current_flair(user, points)
  set_wiki_leaderboard(df, not user_exists_in_leaderboard.empty, user, points)
  set_flair(user_flair_text)

while True:
  try:
    # for all comments in the subreddit
    for comment in subreddit.stream.comments(skip_existing=True):
        print("Found comment")
        # check for !thanks in the body
        if "!thanks" in comment.body.lower():
          # check if the comment author is the same as the parent comment author, OP is replying to themselves
          if comment.parent().author == comment.author:
              print("OP is replying to themselves")
              response = f"You can't thank yourself."
              comment.reply(response)
              continue
          
          # check if the parent comment author is the bot
          if comment.parent().author.name == reddit.user.me():
              response = f"Aw, thanks u/{comment.author.name}"
              comment.reply(response)
              print("User thanked bot")
              continue
    
          # check if the author is a mod
          elif comment.author in moderators:
              print(f"!thanks giver is a mod: {comment.author.name}")
              user = reddit.redditor(comment.parent().author.name)
              thank_user(user)
      
          # check if the submission flair text = "Support" and that the comment is from OP
          elif comment.submission.link_flair_text == "Support" and comment.author == comment.submission.author:
              user = reddit.redditor(comment.parent().author.name)
              has_been_thanked = False
              # get the parent replies to the !thanks to check if they already thanked this comment
              # for parent_reply in comment.parent().replies:
              #     print(f"Found reply: {parent_reply.body} by {parent_reply.author}")
              #     # find the !thanks and its children
              #     if "!thanks" in parent_reply.body:
              #         for child_reply in parent_reply.replies:
              #             print("Found !thanks - checking if has been thanked")
              #             # check if there is already a thanks registered by the bot
              #             if child_reply.author == reddit.user.me() and re.search(r"Thanks for .* registered\.", child_reply.body):
              #                 has_been_thanked = True
              #                 print("!thanks already given")
              #                 break
            
              # get all comments in the thread to check if thanks has already been given to this user
              for comment_in_submission in comment.submission.comments.replace_more(limit=0).list():
                # check for !thanks from OP
                if "!thanks" in comment_in_submission.body.lower() and comment.author == comment.submission.author:
                  # get the user who has already been thanked
                  previously_thanked_user = reddit.redditor(comment_in_submission.parent.author.name)
                  # if thanked user is the same as the newly thanked user
                  if previously_thanked_user == user:
                    for child_reply in comment_in_submission.replies:
                      print("Found !thanks for user - checking if has been thanked")
                      # check if there is already a thanks registered by the bot
                      if child_reply.author == reddit.user.me() and re.search(r"Thanks for .* registered\.", child_reply.body):
                          has_been_thanked = True
                          print("!thanks already given")
                          break
                  
              # if they haven't already been thanked
              if not has_been_thanked:
                  thank_user(user)
              else:
                  response = f"You can only thank someone once per thread."
                  comment.reply(response)
                  print("Thanks not added as OP already thanked this user")
  except praw.exceptions.APIException as e:
    print(f"Encountered an API exception: {e}")
    time.sleep(retry_delay)
  except Exception as e:
    print(f"Encountered an exception: {e}")
    time.sleep(retry_delay)