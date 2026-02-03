import praw, os
import pandas as pd
from datetime import date

print("Running")

reddit = praw.Reddit(client_id=os.environ['client_id'],
                     client_secret=os.environ['client_secret'],
                     username='adbobot',
                     password=os.environ['reddit_password'],
                     user_agent='PyEng Bot 0.1')

subreddit = reddit.subreddit("adbotest")
page_name = "index"
wiki_page = subreddit.wiki[page_name]
wiki_contents = wiki_page.content_md

# split markdown table string into rows
rows = wiki_contents.strip().split('\n')[4:]
# split each row into cells
cells = [[cell.strip() for cell in row.split('|')[1:-1]] for row in rows]
# create a pandas DataFrame from cells
df = pd.DataFrame(cells, columns=['Username', 'Level', 'Last Star Date'])
# convert 'Last Star Date' column to datetime type
df['Last Star Date'] = pd.to_datetime(df['Last Star Date']).dt.date

username_to_find = "u/adbo"
today = date.today()

# extract the numeric value from the Level column
def get_level_num(level):
    if isinstance(level, str):
        level_num = level.split(' ')[-1]
        if level_num.isdigit():
            return int(level_num)
    return None

# get row by username
found_row = df[df['Username'] == username_to_find]
if not found_row.empty:
  print("Located user in table")
  level = found_row['Level'].iloc[0]
  last_star_date = found_row['Last Star Date'].iloc[0]
  print(level)
  print(last_star_date)
  points = int(level.split(" ")[-1])
  print(f"Thanks flair set, incrementing {str(points)} to {str(points + 1)}")
  level = level.replace(str(points), str(points + 1))
  print(level)
  # update the level and date cells on the row matching the username
  df.loc[df['Username'] == username_to_find, 'Level'] = level
  df.loc[df['Username'] == username_to_find, 'Last Star Date'] = today.strftime("%Y-%m-%d")

  # apply the function to create a new column with the numeric value of the Level column
  df['Level Num'] = df['Level'].apply(get_level_num)
  # sort the DataFrame by the Level Num column
  df = df.sort_values(by=['Level Num', 'Last Star Date'], ascending=[False, True])
  # remove the Level Num column
  df = df.drop('Level Num', axis=1)
else:
  print("User not located in table")
  new_row = {'Username': username_to_find, 'Level': "★ 1", 'Last Star Date': today.strftime("%Y-%m-%d")}
  df.loc[len(df)] = new_row

# convert DataFrame back to markdown
markdown_table = f"This page is updated by a robot. Do not edit. *Last update*: {today.strftime('%Y-%m-%d')}\n\n" + df.to_markdown(index=False)
# overwrite subreddit wiki page with new markdown
subreddit.wiki[page_name].edit(content=markdown_table)