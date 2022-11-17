import React from 'react';
import Axios from 'axios';
import { Button } from '@tableau/tableau-ui';
import { toast } from 'react-toastify';
import { collectBy } from 'ramda';



// Declare this so our linter knows that tableau is a global object
/* global tableau */
/* global $ */

class Extension extends React.Component {

  /****************************/
  /*  Define initial state  */
  /****************************/
  constructor(props) {
    super(props);
    this.state = {
      'settings': null,
      'config': null,
      'access_token': null,
      'instance_url': null,
      'saving': false
    };
    //  Bind event handlers to `this`
    this.sendData = this.sendData.bind(this);
    this.resetData = this.resetData.bind(this);

  }
  //  Run when the component is first added to the DOM
  async componentDidMount() {

    //  Save a reference to `this`
    const thisComponent = this;

    //  Get the web app's settings
    const config = await Axios.get('/api/config').then(res => { return res.data; })

    /**************************************/
    /*  Initialize the Tableau extension  */
    /**************************************/

    //  Function to get the extension's settings and update the state
    function loadSettings() {
      //  Fetch the new settings from tableau api
      const settingsString = tableau.extensions.settings.get(config.settingsKey);
      //  Save to this component
      const settings = settingsString ? JSON.parse(settingsString) : config.defaults;
      //  Write any existing settings to the component state
      thisComponent.setState({
        'settings': settings,
        'config': config
      });
    }

    //  Function that runs when the user clicks the configure button in Tableau
    function configure() {

      //  Determine the config popup's url
      const url = `${window.location.href}#${config.configPopup.url}`;

      //  Initialize the extension's config popup     
      tableau.extensions.ui.displayDialogAsync(url, '', config.configPopup.size).then((closePayload) => {
        //  After the popup closes, load the config settings
        loadSettings();
      }).catch((error) => {
        // One expected error condition is when the popup is closed by the user (meaning the user
        // clicks the 'X' in the top right of the dialog).  This can be checked for like so:
        switch (error.errorCode) {
          case tableau.ErrorCodes.DialogClosedByUser:
            //util.log('Config popup was closed by user');
            break;
          default:
          //util.log(error.message);
        }
      });
    }

    //  Initialize the extension
    tableau.extensions.initializeAsync({ 'configure': configure }).then(() => {

      //  Mark the tableau api as loaded
      loadSettings();

      //  Watch for updates to settings
      tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (settingsEvent) => {
        loadSettings();
      });
    });
  }

  /**************************************/
  /*  Event Handlers                    */
  /**************************************/


  async resetData() {
    const thisComponent = this;
    function setoptions() {
      const options = {
        host: "ec2-44-195-100-240.compute-1.amazonaws.com",
        database: "d6khl2b75mr0am",
        user: thisComponent.state.settings.salesforce.username,
        port: 5432,
        password: thisComponent.state.settings.salesforce.password,
        ssl: {
          rejectUnauthorized: false
        }
      }
      return options;

    }
    let opts = setoptions();
    const options = {
      'method': 'POST',
      'url': '/api/reset',
      'headers': {
        'Content-Type': 'application/json',
        // 'access_token': credentials.access_token,
        // 'instance_url': credentials.instance_url
      },
      'data': opts
    };
          //  Update the state, to show that saving is in progress
          thisComponent.setState({ 'saving': true });
    // Execute the API call
    return Axios(options).then(async (response) => {
      //  Double check the response
      if (response.request.status === 200) {
        //  Writeback was successfull
        toast.success(`Success:  ${response.data}`);
        const { dashboard } = tableau.extensions.dashboardContent;
        const ws = dashboard.worksheets.filter((ws) => {
          // return ws.name === this.state.settings.tableau.worksheet;
          return ws.name === "Postgres";
        })[0];
        console.log('worksheet:')
        console.log(ws);
        await ws.getDataSourcesAsync().then((datasources) => {
          console.log(datasources);
          datasources.forEach(async (ds) => {
            console.log(ds);
            console.log(`refreshing ${ds.name}`);
            await ds.refreshAsync();
          })
        })
        return true;
      } else {
        //  Writeback was unsuccessfull
        toast.error(response.data.message)
      }
      return null;
    }).catch((error) => {
      //  Notify the user
      toast.error(error);
      return null;
    }).finally(()=>{
            //  Update the state, to show that saving is in progress
            thisComponent.setState({ 'saving': false });
    });
  }

  /*  Event handler for when a node is clicked  */
  async sendData(e) {

    let thisComponent = this;

    //  Figure out the version of the tableau extension API.
    const versionSplit = tableau.extensions.environment.apiVersion.split('.');
    const apiVersion = {
      'major': versionSplit[0],
      'minor': versionSplit[1],
      'point': versionSplit[2]
    }

    //  Is the API Version >= 1.4.0
    // const apiIs14Plus = (apiVersion.major > 1) || (apiVersion.major == 1 && apiVersion.minor >= 4);

    /**************************************/
    /*  Initialize the Tableau extension  */
    /**************************************/

    /*  Function to get data from the tableau worksheet   */
    async function getDataFromTableauAsync(selectedWorksheet) {

      //  Get the current dashboard
      const { dashboard } = tableau.extensions.dashboardContent;

      //  Get the worksheet with our data
      const matches = dashboard.worksheets.filter((ws) => {
        return ws.name === selectedWorksheet;
      });

      //  Get the summary data from the selected worksheet
      if (matches.length === 1) {
        //  Worksheet found!
        const worksheet = matches[0];
        //  Return the data in that worksheet
        // return worksheet.getSummaryDataAsync().then((response) => {
        // return worksheet.getUnderlyingDataAsync().then((response) => {
        /*         return worksheet.getUnderlyingTableDataAsync().then((response) => {
                  return response;
                }); 
              }
                */
        let lt;
        let dt;
        let logicalTables = await worksheet.getUnderlyingTablesAsync()
        lt = logicalTables;
        console.log('logicalTables');
        console.log(lt);

        let dataTable = await worksheet.getUnderlyingTableDataAsync(logicalTables[0].id)
        dt = dataTable;
        console.log('datatable...');
        console.log(dt);
        console.log(dt);
        return dt;
        //  No worksheet found, return an empty data set
        return null;
      }
    }

    /*  Function to format data for Salesforce  */
    function prepData(tableauData, settings) {

      //  Define the base object
      let data = {
        //"object": settings.salesforce.ObjectName,
        "fields": [],
        "records": []
      }

      //  Function to lookup a column's index
      // const getColumn = (row, col) => {
      //   return row.findIndex((c)=> {
      //     return c.fieldName === col.tableau.fieldName;
      //   });
      // }

      //  Figure out which salesforce fields we are writing to
      // let dict = {}
      // let error = null;
      // Object.keys(settings.salesforce.FieldMappings).forEach( (sfFieldName, index)=>{
      //   //  Pull the reference to this selection
      //   const sfField = settings.salesforce.FieldMappings[sfFieldName];
      //   //  Save to the fields array
      //   data.fields[index] = sfFieldName;
      //   //  Figure out which column from the tableau worksheet, maps to this salesforce column
      //   const tIndex = getColumn(tableauData.columns, sfField);
      //   if (tIndex<0){
      //     //  The fieldname from the extension config, was not found in the tableau worksheet
      //     error = `Could not find the field "${sfField.tableau.fieldName}" in your worksheet, please re-configure the extension's mapping`;
      //   } else {
      //     //  Found the matching column name in the tableau worksheet
      //     sfField.tableau.columnNumber = tIndex;
      //   }
      //   //  Define which tableau column maps to this field
      //   dict[index] = sfField;
      // })

      //  Check for any errors during the field mapping process
      // if (error){
      //   toast.error(error);
      //   return null;
      // }

      // store columns
      for (let i = 0; i < tableauData.columns.length; i++) {
        let idx = tableauData.columns[i].index;
        let n = tableauData.columns[i].fieldName.toLowerCase()
        if (n.includes('sum(')) {
          n = n.substring(4, n.length - 1);  // remove sum(name)
          console.log(n)
        }
        data.fields[idx] = n;
      }

      //  Loop through each record in the dataset from Tableau
      tableauData.data.forEach((row, index) => {
        //  Create a record array
        // let record = [];

        //  Loop through the fields dictionary
        /*           Object.keys(dict).forEach( (sfFieldIndex) => {
                    //  Save the value from the tableau dataset, into the proper salesforce column
                    //    First figure out which tableau column to pull
                    const index = dict[sfFieldIndex].tableau.columnNumber;
                    //    and make sure to safely handle api versions 1.3 or older
                    record[sfFieldIndex] = apiIs14Plus ? row[index].nativeValue : row[index].value;
                  }) */
        //  Save the record
        // data.records.push(record)
        let r = [];
        row.forEach((col, index2) => {
          r.push(col.value === "%null%" || col.value === null ? 0 : col.value);
        });
        data.records.push(r);
      })

      return data;
    }

    /*  Function login to Salesforce and get an access token  */
    function setoptions() {
      //  Define the API call's options
      // const options = {
      //   'method': 'POST',
      //   'url': '/api/salesforce/login',
      //   'data': {
      //     'username': thisComponent.state.settings.salesforce.username,
      //     'password': thisComponent.state.settings.salesforce.password
      //   }
      // };
      const options = {
        host: "ec2-44-195-100-240.compute-1.amazonaws.com",
        database: "d6khl2b75mr0am",
        user: thisComponent.state.settings.salesforce.username,
        port: 5432,
        password: thisComponent.state.settings.salesforce.password,
        ssl: {
          rejectUnauthorized: false
        }
      }
      return options;
      // let self = this;
      // let client = new Client(options);
      // client.connect().then(()=>{
      //   console.log(`client connected`);
      //   // self.client = client;

      // })
      // .then(client.end)
      // .then(()=>{
      //   console.log(`Client disconnected.`)
      // })
      // .catch(err=>{return err.message});

      //  Execute the API call
      /*       return Axios(options).then((response) => {
              return {
                'access_token': response.data.data.access_token,
                'instance_url': response.data.data.instance_url
              };
            }).catch((error) => {
              return {
                'message': "Error: could not authenticate to Salesforce",
                'error': true,
                'details': {}
              };
            }); */
    }

    /*  Function to send data to salesforce   */
    function writeback(data) {

      //  Define the API call's options
      const options = {
        'method': 'POST',
        'url': '/api/upload',
        'headers': {
          'Content-Type': 'application/json',
          // 'access_token': credentials.access_token,
          // 'instance_url': credentials.instance_url
        },
        'data': data
      };

      // Execute the API call
      return Axios(options).then((response) => {
        //  Double check the response
        if (response.request.status === 200) {
          //  Writeback was successfull
          toast.success(`Success:  ${response.data}`);
          return true;
        } else {
          //  Writeback was unsuccessfull
          toast.error(response.data.message)
        }
        return null;
      }).catch((error) => {
        //  Notify the user
        toast.error(error);
        return null;
      }).finally(() => {

      });
      /*       const options = {
              host: "ec2-44-195-100-240.compute-1.amazonaws.com",
              database: "d6khl2b75mr0am",
              user: thisComponent.state.settings.salesforce.username,
              port: 5432,
              password: thisComponent.state.settings.salesforce.password,
              ssl: {
                rejectUnauthorized: false
              }
            }
            let self = this; */
      // let client = new Client(options);
      // client.connect().then(()=>{
      //   console.log(`client connected`);
      //   // self.client = client;

      // })
      // .then(()=>{
      //   console.log(`sending data:`);
      //   console.log(data);
      //   let text = 'insert into SalesTerritories (territory, ae, account) VALUES($1, $2) RETURNING *;';
      //   return client.query(text, data)
      // })
      // .then((res)=>{
      //   toast.success(`Wrote ${JSON.stringify(res)}`);
      //   console.log(`wrote data: ${JSON.stringify(res)}`);
      // })
      // .then(client.end)
      // .then(()=>{
      //   console.log(`Client disconnected.`)
      // })
      // .catch(err=>{
      //   toast.error(err.message);
      //   return err.message;
      // });
    }

    /*  Main function w/ business logic   */
    async function WritebackToDB(settings) {

      //  Load data from a tableau worksheet
      const rawData = await getDataFromTableauAsync(settings.tableau.worksheet);
      //  Check to make sure we found a worksheet with data
      if (!rawData) {
        //  No worksheet with data
        toast.error('No worksheet specified as the data source');
        return false;
      }

      //  Structure data for writeback, based on the field mappings
      const data = prepData(rawData, settings);
      //  Check for an empty data set
      if (!data) {
        //  null returned, error was displayed already
        return false;
      } else if (data.records.length === 0) {
        //  No data to writeback
        toast.info('No data in the worksheet, to write back');
        return false;
      }

      //  Get the access token for writing back to salesforce
      let options = {};
      // if (thisComponent.state.access_token && thisComponent.state.instance_url){
      //   //  Already logged in during this session, so just grab the saved access token & instance url from the state
      //   credentials = {
      //     'access_token': thisComponent.state.access_token,
      //     'instance_url': thisComponent.state.instance_url
      //   }
      // } else {
      //  Need to authenticate to salesforce
      options = await setoptions();
      //  Make sure we got back valid credentials
      if (options.error) {
        //  Failed to get back an access_token, notify the user
        toast.error(options.message);
        //  and stop execution
        return false;
      }
      //  Save back to the state, in case we writeback multiple times
      // thisComponent.setState({
      //   'access_token': credentials.access_token,
      //   'instance_url': credentials.instance_url
      // })
      // }

      //  Send data via REST API
      // const submit = await writeback(data, credentials);
      let obj = {
        data,
        options
      }
      const submit = writeback(obj);
      // return true;
      return submit
    }

    //  Update the state, to show that saving is in progress
    thisComponent.setState({ 'saving': true });

    // Execute the main business logic
    const wasSuccessful = await WritebackToDB(this.state.settings);
    console.log(`result of wasSuccessful`);
    console.log(JSON.stringify(wasSuccessful));
    if (wasSuccessful) {

      const { dashboard } = tableau.extensions.dashboardContent;
      const ws = dashboard.worksheets.filter((ws) => {
        // return ws.name === this.state.settings.tableau.worksheet;
        return ws.name === "Postgres";
      })[0];
      console.log('worksheet:')
      console.log(ws);
      await ws.getDataSourcesAsync().then((datasources) => {
        console.log(datasources);
        datasources.forEach(async (ds) => {
          console.log(ds);
          console.log(`refreshing ${ds.name}`);
          await ds.refreshAsync();
        })
      })
    }
    // await ws.refreshAsync();
    // tableau.extensions.dashboardContent.dashboard.worksheets.find(w => w.name === this.state.settings.tableau.worksheet).refreshAsync();
    //.getDataSourcesAsync()
    //  Update the state
    thisComponent.setState({ 'saving': false });
  }

  /**************************************/
  /*  HTML Output to render             */
  /**************************************/
  render() {
    // eslint-disable-next-line react/destructuring-assignment
    const content = () => {
      if (this.state.saving) {
        return <Button kind="primary" key="writeback" disabled >Saving...</Button>
      } else {
        return (<div>
          <Button key="writeback" onClick={this.sendData} className="tableau-worksheet">Save</Button>
          <Button kind="lowEmphasis" key="resetData" onClick={this.resetData} className={"tableau-worksheet"}>Reset</Button>
        </div>)
      }
    }

    return (
      <div>
        {content()}
      </div>
    );
  }
}

export default Extension;
