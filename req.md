upwork searcher chrome extension development

https://www.upwork.com/nx/search/talent/?loc=united-states&q=react&page=526&nav_dir=pop

scan the upwork pages, increasing page query parameter

Each page will show list of freelancers, about 10
It needs to find links like that

<a data-v-85eccfdc="" href="/freelancers/~017e40873c56838f54?referrer_url_path=/nx/search/talent/" class="up-n-link profile-link" data-test="UpLink">
            Sr Software Engineer, Ruby on Rails, React
          </a>

then open in a new tab
so 10 new tabs should be opened
upwork is protected by cloudflare challenge, if it shows challenge, can you pass it or by user?

on each freelancers profile, there may be a button that redirects to github profile page on a new page.
The goal is to get the github profile links.

The github button element is looking like this

<div data-v-7bffef5a="" class="py-4x"><div data-v-396e9190="" data-v-7bffef5a="" class="px-0 pt-0"><div data-v-396e9190="" class="air3-grid-container gap-0"><div data-v-396e9190="" class="span-8"><span data-v-396e9190="" class="title">
        GitHub
        </span> <span data-v-396e9190="" class="since">
        Since
        2020
      </span> <div data-v-396e9190="" class="air3-grid-container"><div data-v-396e9190="" class="span-12 username">
          Kyle Parks
        </div></div></div> <div data-v-396e9190="" class="span-4 text-right avatar"><img data-v-396e9190="" src="https://avatars.githubusercontent.com/u/72591323?v=4" alt="Kyle Parks" referrerpolicy="no-referrer" class="air3-avatar"></div> <div data-v-396e9190="" class="span-12 view-profile d-flex align-items-center mt-4x"><div data-v-396e9190="" class="mr-3x air3-icon md"><svg xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" viewBox="0 0 24 24" role="img"><path vector-effect="non-scaling-stroke" stroke="var(--icon-color, #001e00)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="M10.04 7H8.027C5.212 7 3 9.2 3 12s2.212 5 5.028 5h2.011m3.921 0h2.012C18.788 17 21 14.8 21 12s-2.212-5-5.028-5h-2.011M9 12h6"></path></svg></div> <a data-v-396e9190="" href="javascript:" class="up-n-link no-underline">
        View profile
      </a></div> <div data-v-396e9190="" class="span-12 followers d-flex align-items-center mt-4x"><div data-v-396e9190="" class="mr-3x air3-icon md"><svg xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" viewBox="0 0 24 24" role="img"><path vector-effect="non-scaling-stroke" stroke="var(--icon-color, #001e00)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="M12 21a9 9 0 100-18 9 9 0 000 18z"></path><path vector-effect="non-scaling-stroke" stroke="var(--icon-color, #001e00)" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="M12 11.73a2.97 2.97 0 100-5.94 2.97 2.97 0 000 5.94zm0 1.89c-2.88 0-5.31 2.34-5.31 5.31v.36C8.22 20.37 10.02 21 12 21c1.98 0 3.78-.63 5.31-1.71v-.36c0-2.88-2.43-5.31-5.31-5.31z"></path></svg></div>
      2
      followers
    </div> <!----></div></div> <!----> <!----></div>
