import { mapProps } from 'laravel-nova';
import { parseLocationHash, updateLocationHash } from "../utils/hash";
import orderBy from 'lodash/orderBy';
import unset from 'lodash/unset';
import { uid } from 'uid/single';

export default {

  props: {
    panel: {
      type: Object,
      required: true,
    },
    name: {
      default: 'Panel',
    },
    fields: {
      type: Array,
      default: [],
    },
    formUniqueId: {
      type: String,
      required: false
    },
    validationErrors: {
      type: Object,
      required: false,
    },

    ...mapProps([
      'shownViaNewRelationModal',
      'mode',
      'resourceName',
      'resourceId',
      'relatedResourceName',
      'relatedResourceId',
      'viaResource',
      'viaResourceId',
      'viaRelationship',
    ]),
  },

  data() {
    return {
      tabs: null,
      activeTab: '',
      selectedTab: {},
      darkModeClass: '',
      relationFormUniqueId: '',
      errors: this.validationErrors,
      visibleTabsName: [],
      visibleTabsKeys: []
    };
  },

  emits: [
    'field-changed',
    'update-last-retrieved-at-timestamp',
    'file-upload-started',
    'file-upload-finished',
  ],

  /**
   * Get the tabs and their respective fields when mounted
   * and show the first tab by default.
   */
  mounted() {

    this.darkModeClass = document.documentElement.classList.contains('dark') ? 'tabs-dark' : '';

    Nova.$on('nova-theme-switched', ({ theme }) => {
      this.darkModeClass = theme === 'dark' ? 'tabs-dark' : '';
    });

    const tabs = this.tabs = this.setTabs();
    this.visibleTabsName = [];
    this.visibleTabsKeys = [];
    /* set change event */
    let keys = Object.keys(tabs);
    if(keys.length > 0){
      Object.keys(tabs).forEach(key => {
        if(tabs[key] != undefined && tabs[key].hasOwnProperty('properties') && Object.keys(tabs[key].properties).length > 0){
          if(tabs[key].properties.changedAttribute != undefined && tabs[key].properties.attributeValue != undefined && tabs[key].properties.changedAttribute.length > 0 && tabs[key].properties.attributeValue.length > 0){
            this.attributeValue = tabs[key].properties.attributeValue;
            this.changedAttribute = tabs[key].properties.changedAttribute;
            let selectedValue = this.checkTabShowOrHide(tabs, tabs[key].properties.changedAttribute);
            if (this.resourceId != undefined && selectedValue != null) {
              if(tabs[key].properties.attributeValue.includes(selectedValue.toString())){
                this.visibleTabsName.push(tabs[key].name);
                this.visibleTabsKeys.push(key);
                tabs[key].properties.shouldShow = true;
              }else{
                if(this.visibleTabsName.includes(tabs[key].name) && this.visibleTabsKeys.includes(key)){
                  delete this.visibleTabsName[tabs[key].name];
                  delete this.visibleTabsKeys[key];
                }
                tabs[key].properties.shouldShow = false;
              }
            }else{
              tabs[key].properties.shouldShow = false;
            }
            Nova.$off(tabs[key].properties.changedAttribute+'-change', this.changeAttributeValue);
            Nova.$on(tabs[key].properties.changedAttribute+'-change', this.changeAttributeValue);
          }else{
            this.visibleTabsName.push(tabs[key].name);
            this.visibleTabsKeys.push(key);
          }
        }
      });
    }
    /* end change event */
    const routeTabs = parseLocationHash();
    const currentTabSlug = routeTabs[this.getTabsReference()];

    if (tabs[currentTabSlug]) {
      this.handleTabClick(tabs[currentTabSlug])
    } else {
      this.handleTabClick(tabs[Object.keys(tabs)[0]], true);
    }

    if (this.panel.retainTabPosition === true && Nova?.store?.tabsListenerRegistered !== true) {
      document.addEventListener('inertia:before', (event) => {
        if (event?.detail?.visit?.url) {
          let currPath = window.location.pathname;
          let newPath = event?.detail?.visit?.url?.pathname;

          currPath = currPath.substring(currPath.length - 5) === "/edit" ? currPath.substring(0, currPath.length - 5) : currPath;
          newPath = newPath.substring(newPath.length - 5) === "/edit" ? newPath.substring(0, newPath.length - 5) : newPath;

          if (currPath === newPath) {
            this.locationHash = parseLocationHash();
            event.detail.visit.url.hash = window.location.hash ?? "";
          }
        }
        delete (Nova.store.tabsListenerRegistered);
        return event;
      }, { once: true });

      // Fix issues with tab being cleared before navigation, and history.back() not working correctly
      document.addEventListener('inertia:start', (event) => {
        if (this.locationHash) {
          updateLocationHash(this.locationHash);
          this.locationHash = null;
        }
      }, { once: true });

      Nova.store.tabsListenerRegistered = true;
    }

    if (this.tabMode === 'form') {
      this.$watch('validationErrors', (newErrors) => {
        if (newErrors.errors) {
          Object.entries(newErrors.errors).forEach(error => {
            if (error[0] && this.fields.find(x => x.attribute === error[0])) {
              let field = this.getNestedObject(this.fields, 'attribute', error[0]);
              let slug = this.getNestedObject(this.fields, 'attribute', error[0]).tabSlug + '-tab';
              let addClasses = ['tabs-text-' + this.getErrorColor() + '-500', 'tabs-border-b-2', 'tabs-border-b-' + this.getErrorColor() + '-500', 'tab-has-error']
              let removeClasses = ['tabs-text-gray-600', 'hover:tabs-text-gray-800', 'dark:tabs-text-gray-400', 'hover:dark:tabs-text-gray-200']
              this.$refs[slug][0].classList.add(...addClasses)
              this.$refs[slug][0].classList.remove(...removeClasses)
            }
          });
        }
      })
    }
  },

  methods: {

    checkTabShowOrHide(tabs, changeAttribute) {
      let selectedTabs = null;
      let selectedValue = null;
      Object.keys(tabs).forEach(key => {
        if (tabs[key] != undefined && tabs[key].hasOwnProperty('properties') && Object.keys(tabs[key].properties).length > 0) {
          selectedTabs = tabs;
          selectedTabs[key].fields.forEach(ChildKey => {
            if (ChildKey.attribute == changeAttribute) {
              let value = ChildKey.value;
              selectedValue = value
            }
          });
        }
      });
      return selectedValue;
    },
    changeAttributeValue(value) {
      let tabs = this.tabs;
      let keys = Object.keys(tabs);
      if(keys.length > 0){
        let $this = this;
        this.visibleTabsName =  [];
        this.visibleTabsKeys =  [];
        Object.keys(tabs).forEach(key => {
          if (tabs[key] != undefined && tabs[key].hasOwnProperty('properties') && Object.keys(tabs[key].properties).length > 0) {
            if ($this.changedAttribute == tabs[key].properties.changedAttribute) {
              if(tabs[key].properties.attributeValue.includes(value)){
                this.visibleTabsName.push(tabs[key].name);
                this.visibleTabsKeys.push(key);
                tabs[key].properties.shouldShow = true;
              }else{
                if(this.visibleTabsName.includes(tabs[key].name) && this.visibleTabsKeys.includes(key)){
                  delete this.visibleTabsName[tabs[key].name];
                  delete this.visibleTabsKeys[key];
                }
                tabs[key].properties.shouldShow = false;
              }
            }else{
              this.visibleTabsName.push(tabs[key].name);
              this.visibleTabsKeys.push(key);
            }
          }
        });
      }
      this.tabs = tabs;
    },

    /**
     * Set Tabs
     * @returns Tabs Object
     */
    setTabs() {
      return this.panel.fields.reduce((tabs, field) => {
        if (!(field.tabSlug in tabs)) {
          tabs[field.tabSlug] = {
            name: field.tab,
            slug: field.tabSlug,
            position: field.tabPosition,
            init: false,
            listable: field.listableTab,
            fields: [],
            properties: field.tabInfo,
            classes: 'fields-tab',
          };
          if (['belongs-to-many-field', 'has-many-field', 'has-many-through-field', 'has-one-through-field', 'morph-to-many-field',].includes(field.component)) {
            tabs[field.tabSlug].classes = 'relationship-tab';
          }
        }
        tabs[field.tabSlug].fields.push(field);
        return tabs;
      }, {});
    },

    /**
     * Get the resource ID we pass on to the field component
     *
     * @param field
     * @returns {Number|String|*}
     */
    getResourceId(field) {
      if (field.relationshipType === 'hasOne') {
        return field.hasOneId
      }

      if (field.relationshipType === 'morphOne') {
        return field.hasOneId
      }

      return this.resourceId;
    },

    /**
     * Handle tabs being clicked
     *
     * @param tab
     * @param updateUri
     */
    handleTabClick(tab, updateUri = true, refreshCodeMirror = true) {
      this.selectedTab = tab;

      Nova.$emit('nova-tabs-changed', this.getTabsReference(), tab)

      if (updateUri) {
        this.setLocationHash()
      }

      if (refreshCodeMirror) {
        this.refreshCodeMirror(tab);
      }
    },

    refreshCodeMirror(tab) {
      setTimeout(() => {
        const tabRef = this.getTabRefName(tab);
        if (!tabRef) return;

        let refs = this.$refs[tabRef];
        if (!refs.length) return;

        refs.forEach(ref => {
          const cmList = ref.querySelectorAll('.CodeMirror');
          if (!cmList.length) return;

          cmList.forEach(cm => cm.CodeMirror.refresh());
        });
      }, 1);
    },

    /**
     * Update the location hash to persist route state
     */
    setLocationHash() {
      const routeTabs = parseLocationHash()
      routeTabs[this.getTabsReference()] = this.selectedTab.slug;
      updateLocationHash(routeTabs)
    },

    /**
     * Get the component name.
     *
     * @param field
     * @returns {string}
     */
    getComponentName(field) {
      return field.prefixComponent
        ? this.tabMode + '-' + field.component
        : field.component
    },

    /**
     * Get the Tabs reference.
     *
     * @returns string;
     */
    getTabsReference() {
      return this.panel.slug ?? this.panel.name;
    },

    /**
     * Get body class for tabbed field panel
     *
     * @param tab
     * @returns {string}
     */
    getBodyClass(tab) {
      return tab.properties.bodyClass;
    },

    /**
     * Get reference name for tab
     *
     * @param tab
     * @returns {string}
     */
    getTabRefName(tab) {
      return `tab-${tab.slug}`;
    },

    /**
     * Check if the specified tab is the current opened one
     *
     * @param tab
     * @returns {boolean}
     */
    getIsTabCurrent(tab) {
      if(this.selectedTab === tab && !this.visibleTabsName.includes(tab.name)){
        let updateTab = this.tabs[this.visibleTabsKeys[0]]
        this.handleTabClick(updateTab);
      }
      return this.selectedTab === tab || (!this.selectedTab && this.tabs[Object.keys(this.tabs)[0]] === tab)
    },

    /**
     * Sort the tabs object by their respective positions using lodash
     *
     * @param tabs
     * @returns {object}
     */
    getSortedTabs(tabs) {
      return orderBy(tabs, [c => c.position], ['asc']);
    },

    /**
     * Get nested object with specified key from object
     *
     * @param entireObj
     * @param keyToFind
     * @param valToFind
     * @returns {*}
     */
    getNestedObject(entireObj, keyToFind, valToFind) {
      let foundObj;
      JSON.stringify(entireObj, (_, nestedValue) => {
        if (nestedValue && nestedValue[keyToFind] === valToFind) {
          foundObj = nestedValue;
        }
        return nestedValue;
      });
      return foundObj;
    },

    /**
     * Get the color for the current tab
     *
     * @returns {*|string}
     */
    getCurrentColor() {
      return this.panel.currentColor ?? 'primary';
    },

    /**
     * Get the color for tabs with errors
     *
     * @returns {*|string}
     */
    getErrorColor() {
      return this.panel.errorColor ?? 'red';
    }

  },

}
