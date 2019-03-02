Implmentation of rrweb REPL tool to be used by single cli command for purposes of usability test with automated scenario.

Usage:
1. download zip of `recorder` branch
2. unzip
3. `npm install`
4. `npm run rec {url} {optional_exposure_time_in_sec} {custom_script}`
5. after close see `./recordings/` for last recording

A recording is named by date and url stored as:
1. JSON of array of events in `.json` file
2. A `.html` page with player with events
3. Continuously stored list of individual events (each in one line) in `.rec` file

{custom_script} is a script that would be injected into every page. The script should be located in rrweb folder. Extension `.js` is appended automaticcally.

Compared to original rrweb with events are stored values of browser window position and dimension.
