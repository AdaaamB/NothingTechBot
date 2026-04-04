# NothingTechBot
u/NothingTechBot is a Reddit PRAW bot that runs on [r/NothingTech](https://reddit.com/r/NothingTech), monitoring for commands such as `!answer`, `!solved` and `!support` and performing various actions based on each command. It also features a number of commands relating to the [nothing.wiki](https://nothing.wiki) such as `!wiki <query>`, which finds and links to some of our specific wiki pages we've indexed, or `!app <query>` which finds apps developed by Nothing community developers, then responds with a link.


## Bot Commands
Below is a list of all bot commands and their functions. These are triggered by writing a comment on [r/NothingTech](https://reddit.com/r/NothingTech) containing one of these key words.

|Command|Example|Usage|
|--|--|--|
|`!answer`|*That's the !answer, thanks!*|To set someone's response as best answer to your thread and update the flair to Solved. OP + Mods only.|
|`!solved`|*This !solved my query.*|To update your thread's flair to Solved. OP + Mods only.
|`!support`|*You should contact !support*|The bot will comment with some official links for contacting Nothing's support.|
|`!link <query>`|*!link phone (3a)*|The bot will respond with a direct link to a specified page. Replace "Phone (3a)" with your query. E.g. "Phone (1)", "Community", etc.|
|`!wiki <query>`|*!wiki nfc icon*|The bot will respond with a direct link to our [r/NothingTech](/r/NothingTech) wiki pages/topics. Replace "nfc icon" with your query. E.g. "best chargers", "Nothing icon pack", etc.|
|`!app <query>`|*!app dialer*|The bot will respond with a direct link to a specified community-developed app. [View all community apps](https://www.reddit.com/r/NothingTech/wiki/library/community-apps).|
|`!glyph <query>`|*!glyph bngc*|The both will respond with a direct link to a specified community Glyph project. [View all community Glyph projects](https://www.reddit.com/r/NothingTech/wiki/library/glyph-projects/).|
|`!firmware <query>`|*!firmware unbrick*|The both will respond with a direct link to the community-maintained stock Nothing OS Firmware Repository.|

## Command editor
The bot's index of links, wiki pages, apps, glyph tools and firmware is stored in a yaml file which is accessed by the bot at runtime. We have a vibe coded web UI for easily adding, removing and updating entries in the index which is available here: https://rnothingtech.github.io/NothingTechBot/editor/