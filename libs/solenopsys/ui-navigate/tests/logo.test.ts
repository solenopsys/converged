import { render } from '@solenopsys/converged-renderer';
import {test, expect} from 'bun:test';
import {UiLogo} from '../src/logo/logo'

test('UiLogo', async () => {
	 render(UiLogo({logo:'/images/logo.svg',alt:'logo'}), document.body);
	 const img = document.querySelector('img');
	 expect(img?.alt).toEqual('logo');
	 expect(img?.src).toEqual('/images/logo.svg');
	 //expect(img?.classList.contains('logo')).toBeTruthy();


	 console.log("DOCUMENT",document.body.innerHTML)
   });