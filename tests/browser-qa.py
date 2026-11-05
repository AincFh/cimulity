"""Real Chromium smoke for the *built* Next.js static Pages export."""
import json
import pathlib
import shutil
import socketserver
import threading
import time
from http.server import SimpleHTTPRequestHandler
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"out"
assert (OUT/"index.html").is_file(),"next build did not generate out/index.html"
SITE=ROOT/"test-artifacts"/"_local-pages"
TARGET=SITE/"cimulity"
TARGET.parent.mkdir(parents=True,exist_ok=True)
shutil.copytree(OUT,TARGET,dirs_exist_ok=True)
PROOF=ROOT/"test-artifacts"/"browser"
PROOF.mkdir(parents=True,exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(SITE),**kw)
    def log_message(self,*a):pass

with socketserver.TCPServer(("127.0.0.1",0),Handler) as server:
    threading.Thread(target=server.serve_forever,daemon=True).start()
    opt=Options()
    opt.add_argument("--headless=new")
    opt.add_argument("--no-sandbox")
    opt.add_argument("--disable-dev-shm-usage")
    opt.add_argument("--use-angle=swiftshader")
    opt.add_argument("--enable-unsafe-swiftshader")
    opt.add_argument("--window-size=1440,900")
    opt.set_capability("goog:loggingPrefs",{"browser":"ALL"})
    browser=webdriver.Chrome(options=opt)
    browser.set_page_load_timeout(55)
    try:
        url=f"http://127.0.0.1:{server.server_address[1]}/cimulity/"
        browser.get(url)
        for _ in range(65):
            snap=browser.execute_script("""return {
              title:document.title,
              canvas:document.querySelectorAll('canvas').length,
              newCity:[...document.querySelectorAll('button')].some(x=>x.textContent?.includes('New City')),
              pause:[...document.querySelectorAll('button')].some(x=>x.textContent?.includes('Pause'))
            }""")
            if snap["canvas"] and snap["newCity"] and snap["pause"]:break
            time.sleep(.45)
        assert snap["canvas"] and snap["newCity"] and snap["pause"],snap
        browser.save_screenshot(str(PROOF/"city-desktop.png"))
        pause=browser.find_element(By.XPATH,"//button[contains(., 'Pause')]")
        pause.click()
        time.sleep(.15)
        assert len(browser.find_elements(By.XPATH,"//button[contains(., 'Play')]"))>0,"pause toggle failed"
        play=browser.find_element(By.XPATH,"//button[contains(., 'Play')]")
        play.click()
        assert len(browser.find_elements(By.XPATH,"//button[contains(., 'Pause')]"))>0,"resume toggle failed"
        browser.set_window_size(390,844)
        time.sleep(.5)
        mobile=browser.execute_script("""return {
          width:innerWidth,
          scrollWidth:document.documentElement.scrollWidth,
          canvas:document.querySelectorAll('canvas').length,
          newCity:[...document.querySelectorAll('button')].some(x=>x.textContent?.includes('New City'))
        }""")
        assert mobile["canvas"] and mobile["newCity"],mobile
        layout=browser.execute_script("""return (() => {
          const t=document.querySelector('.city-tools-shell');
          const h=document.querySelector('.city-hud-shell');
          const dock=document.querySelector('.city-mobile-dock');
          const rect=dock.getBoundingClientRect();
          return {toolsHidden:getComputedStyle(t).display==='none',
            hudHidden:getComputedStyle(h).display==='none',
            dockVisible:getComputedStyle(dock).display!=='none',
            dockBottom:rect.bottom,viewportHeight:innerHeight,
            horizontalOverflow:document.documentElement.scrollWidth>innerWidth+4};
        })()""")
        assert layout["toolsHidden"] and layout["hudHidden"],layout
        assert layout["dockVisible"] and layout["dockBottom"]<=layout["viewportHeight"],layout
        assert not layout["horizontalOverflow"],layout
        browser.save_screenshot(str(PROOF/"city-mobile-map-unobstructed.png"))
        build=browser.find_element(By.XPATH,"//div[contains(@class,'city-mobile-dock')]/button[normalize-space(.)='建造']")
        build.click()
        assert browser.find_element(By.ID,'city-mobile-tools').get_attribute('data-open')=='true'
        assert browser.find_element(By.XPATH,"//button[contains(., 'Residential')]").is_displayed()
        browser.save_screenshot(str(PROOF/"city-mobile-tools-open.png"))
        build.click()
        assert browser.find_element(By.ID,'city-mobile-tools').get_attribute('data-open')=='false'
        budget=browser.find_element(By.XPATH,"//div[contains(@class,'city-mobile-dock')]/button[normalize-space(.)='统计']")
        budget.click()
        assert browser.find_element(By.ID,'city-mobile-hud').get_attribute('data-open')=='true'
        assert browser.find_element(By.ID,'city-mobile-tools').get_attribute('data-open')=='false'
        browser.save_screenshot(str(PROOF/"city-mobile-finances-open.png"))
        budget.click()
        assert browser.find_element(By.ID,'city-mobile-hud').get_attribute('data-open')=='false'
        mobile["layout"]=layout
        mobile["toolsToggle"]=True
        mobile["statsToggle"]=True
        errors=[e["message"] for e in browser.get_log("browser") if e["level"]=="SEVERE"]
        local_errors=[e for e in errors if "127.0.0.1" in e or "Uncaught" in e]
        assert not local_errors,local_errors
        report={"ready":snap,"mobile":mobile,"pauseResume":True,"errors":errors[:10]}
        (PROOF/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(report,ensure_ascii=False,indent=2))
    finally:
        browser.quit()
        server.shutdown()
